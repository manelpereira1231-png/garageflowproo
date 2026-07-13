## Auditoria — o que já existe

**Reutilizar (sem duplicar):**
- `src/pages/Agenda.tsx` — página, grelha semanal, dialog criar/editar, realtime, i18n, filtros por status, mobile view. Base sólida — evoluir, não substituir.
- `src/pages/ServiceCatalog.tsx` + tabela `service_catalog` — já tem `default_time` (duração prevista), `default_price`, `active`. **É a fonte única de duração** — nada de campos novos.
- `src/pages/Team.tsx` + `shop_users(role)` — já lista mecânicos da oficina. **É a fonte única de mecânicos**.
- `src/pages/Services.tsx` (ordens de serviço) + tabela `work_orders(technician,status)` — ocupação real dos mecânicos vem daqui.
- `src/pages/PublicBooking.tsx` — portal público já cria appointments com `source='portal'`.
- Realtime já configurado em `appointments` (Layout + Agenda).
- Notificações via tabela `notifications` (Layout já subscreve).

**Lacunas mínimas identificadas** (só o estritamente necessário):
1. `appointments` não tem `service_id` nem `assigned_to` (mecânico). Hoje guarda só `service_type` como texto livre.
2. `shops` não tem `opening_hours` (horário funcionamento por dia da semana).
3. Não há registo de ausências/férias/pausas dos mecânicos.

## Plano de evolução (incremental, sem regressões)

### 1. Migração DB (aditiva, nada removido)
- `appointments`: adicionar `service_id uuid` (FK opcional para `service_catalog`) e `assigned_to uuid` (FK opcional para `auth.users`). Manter `service_type` texto por retrocompatibilidade.
- `shops`: adicionar `opening_hours jsonb` (`{mon:{open:"09:00",close:"18:00",break:["13:00","14:00"]}, …}`) com default sensato.
- Nova tabela `staff_absences(shop_id, user_id, start_at, end_at, reason)` com RLS + GRANT (padrão do projeto).
- Nada alterado em `service_catalog`, `work_orders`, `clients`, `vehicles`, `shop_users`, RLS existente.

### 2. Motor de agendamento inteligente (novo módulo utilitário, sem UI nova)
`src/lib/schedulingEngine.ts` — funções puras reutilizáveis:
- `getBusyIntervals(shopId, date, mechanicId?)` — junta `appointments` + `work_orders` em curso + `staff_absences`.
- `suggestSlots({shopId, serviceId, preferredDate, mechanicId?})` — devolve **top 3 slots** aplicando:
  - horário de funcionamento (`shops.opening_hours`),
  - duração vinda de `service_catalog.default_time`,
  - conflitos por mecânico e por dia,
  - férias/pausas,
  - primeiro horário livre + melhor mecânico (menos carga no dia).
- `detectConflicts(appt)` — validação síncrona antes de gravar.

### 3. Agenda evoluída (mesma UI, mais inteligente)
Alterações em `src/pages/Agenda.tsx` (sem redesign):
- Dialog "Novo agendamento": ao escolher um serviço do catálogo → duração e preço pré-preenchidos automaticamente (hoje escreve-se à mão).
- Novo campo "Mecânico" (dropdown alimentado por `shop_users`) — opcional.
- Botão **"Sugerir melhor horário"** — chama `suggestSlots` e mostra top 3 clicáveis. Utilizador só confirma.
- Ao gravar: `detectConflicts` bloqueia sobreposições e oferece próximo slot livre.
- Ao arrastar / mudar duração / cancelar → recalcular apenas os appointments *desse mecânico nesse dia* (ordem preservada, sem recolocação global agressiva).
- Notificação automática para o mecânico atribuído (linha em `notifications`, Layout já apanha).

### 4. Configuração admin (sem código)
`src/pages/Settings.tsx` (secção "Oficina"):
- Editor de `opening_hours` por dia (horas + pausa almoço).
- Editor de ausências (lista + criar) — usa `staff_absences`.
Toda a regra de negócio lê destes campos — nada hardcoded.

### 5. Responsividade
Manter os padrões atuais (`hidden sm:block`/`sm:hidden`), sem scroll horizontal. Dialog e sugestões de slot em lista vertical no mobile.

## O que NÃO será feito
- Não criar nova página de Agenda, novo layout, novo dashboard.
- Não duplicar catálogo, mecânicos, horários.
- Não mexer em auth, RLS existente, edge functions, APIs, Market.
- Não remover `service_type` texto (retrocompatível com PublicBooking e dados antigos).
- Não alterar aparência das tabelas já corrigidas.

## Ordem de execução
1. Migração DB (aprovada pelo user).
2. `schedulingEngine.ts` + testes manuais.
3. Evolução `Agenda.tsx` (dialog + sugestões + conflitos + recálculo).
4. Config em Settings (horários + ausências).
5. Validação visual em desktop/tablet/mobile.

Confirmas para avançar?
