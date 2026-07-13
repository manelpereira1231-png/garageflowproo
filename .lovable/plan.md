## Auditoria — o que já existe (a reutilizar, nunca duplicar)

**Autenticação**
- `src/pages/Auth.tsx` — login/signup único. `useAuthReady` + `useAuthUser` (hot session cache, sem chamadas extra a `/auth/user`).
- Realms isolados (ERP vs Market) em `src/integrations/supabase/realmClients.ts`. Manter.
- Super-admin em `useSuperAdmin` — não tocar.

**Utilizadores da oficina**
- Tabela `shop_users(shop_id, user_id, role text)` — já em uso; roles atuais: `owner`, `manager`, `technician`.
- Página `src/pages/Team.tsx` — convite via email + change role + remove. **Fonte única da equipa.**
- RPC `get_shop_member_emails`, `get_user_shop_ids` — já existem.
- `useShopContext` + `useActiveShopId` — contexto multi-oficina reactivo.

**RLS existente**
- Quase todas as tabelas (`clients, vehicles, quotes, work_orders, invoices, appointments, service_catalog, parts, alerts, notifications, staff_absences`…) já filtram por `shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())` **ou** `shop_id IN (SELECT shop_id FROM shop_users WHERE user_id = auth.uid())`. Ou seja: proprietários e membros da equipa já vêem os dados. O que falta é **restringir por perfil (role) dentro da mesma oficina**.

**Layout / sidebar**
- `src/components/Layout.tsx` — navegação única. `useSidebarPrefs` permite personalização.
- `src/pages/Workshop.tsx` — já é um painel operacional para mecânicos (existe mas subutilizado).

## Lacunas identificadas
1. Roles limitados a 3 (`owner/manager/technician`). Faltam **`reception`** e **`commercial`**.
2. Não há **capabilities** granulares por role → toda a UI mostra tudo aos membros.
3. RLS de tabelas financeiras (`invoices`, `quotes.cost_total/profit`, `work_orders.cost_total/profit`, `parts.internal_cost`, `payments`, `shop_wallets`) não distingue role — receção/mecânico vêem custos/lucros.
4. Sem página inicial diferente por role — todos caem em `/dashboard`.
5. Sem audit log de acessos (last_login, IP, device, force_logout).

## Plano (5 fases, incremental, zero regressões)

### Fase 1 — Base de roles e capabilities (server + client, uma única fonte)
**Migração DB:**
- `shop_users`: passar `role` para enum `shop_role` = `owner | admin | manager | reception | technician | commercial`. Manter valores existentes.
- Nova tabela `shop_user_profiles(shop_user_id, name, phone, position, avatar_url, active, created_at, updated_at)` — dados adicionais do colaborador (nome/foto/cargo) sem tocar em `auth.users`.
- Nova função SECURITY DEFINER `public.current_shop_role(_shop_id uuid) returns shop_role` — devolve o role do utilizador na oficina; usada por RLS e frontend.
- Nova função `public.has_capability(_shop_id uuid, _cap text) returns boolean` — consulta um mapa role→capabilities canónico (dentro da própria função, imutável) para evitar tabela extra manipulável.

**Capabilities canónicas (uma única definição, server-side):**
```
clients.view/create/edit/delete
vehicles.view/create/edit/delete
quotes.view/create/edit/approve
work_orders.view/create/edit/complete
invoices.view/create/cancel
finance.view_costs/view_profits/view_salaries
stock.view/manage
purchases.view/manage
agenda.view/manage
marketplace.view/manage
team.view/manage
settings.manage
audit.view
```
Matriz role→capabilities: owner=tudo; admin=tudo exceto `settings.transfer_ownership` + `team.remove_owner`; manager=operacional + finance limitada; reception=clients/vehicles/quotes/work_orders/agenda (sem finance/marketplace/settings); commercial=clients/vehicles/quotes + leads (sem stock/finance/settings); technician=**nenhuma capability web tradicional** — usa o painel Workshop.

**Frontend:**
- Novo hook `src/hooks/useShopRole.ts` — devolve `{ role, can(cap) }` alimentado por `current_shop_role` (uma query por sessão, cached).
- Componente `<Can cap="finance.view_costs">…</Can>` para condicionar botões/campos. **Não substitui RLS — é UX.**

### Fase 2 — RLS por role (backend enforcement real)
**Views seguras (nunca esconder colunas apenas no client):**
- `public.quotes_public` (sem `cost_total`, `profit`, linhas de custo interno) + policy na base a negar SELECT para roles sem `finance.view_costs`.
- `public.work_orders_public` idem.
- `public.parts_public` sem `internal_cost`.
- `payments`, `shop_wallets`, `invoices.total`/`vat_total` continuam completos, mas com policy: apenas roles com `finance.view_costs` conseguem SELECT.

Padrão SQL (aplicado a cada tabela financeira):
```sql
CREATE POLICY "financial_role_read" ON public.<t>
FOR SELECT USING (
  public.has_capability(shop_id, 'finance.view_costs')
);
```
Escrita continua a exigir role adequado (`quotes.approve`, `invoices.create`, etc.).

Frontend passa a ler as `_public` views para os roles não financeiros; a query cai naturalmente para a view/tabela conforme o role — sem `if` no client.

### Fase 3 — Fluxo e experiência por role
- `/` (após login) redireciona conforme role:
  - `technician` → `/workshop` (painel operacional já existente, melhorado)
  - `reception` → `/agenda`
  - `commercial` → `/clients?tab=leads`
  - `owner/admin/manager` → `/dashboard` (atual)
- `Layout.tsx` filtra items da sidebar através de `can()` — nada duplicado, só se esconde.
- `Team.tsx` ganha:
  - dropdown de roles com as 6 opções + descrição;
  - form completo (nome, telefone, cargo, foto) gravado em `shop_user_profiles`;
  - ações: desativar/reativar/suspender/forçar logout/obrigar reset password/transferir propriedade.
- `Workshop.tsx` (painel do mecânico) já existe — completar com: iniciar/pausar/retomar/concluir (usa `work_order_times` já existente), fotos/vídeos (`work_order_attachments` já existe), checklist (`inspection_checklists`), pedido de aprovação/ajuda (linha em `notifications`).

### Fase 4 — Agenda inteligente com competências
Extensão do motor `src/lib/schedulingEngine.ts` já criado:
- Ler `shop_user_profiles.skills text[]` (nova coluna) e `service_catalog.required_skill text` (nova coluna, opcional).
- `suggestSlots` filtra mecânicos com skill compatível e escolhe o de menor carga no dia (aprendizagem simples via `work_order_times` histórico → média por serviço, se `service_catalog.default_time` estiver a zero).

### Fase 5 — Auditoria e sessões
- Tabela `audit_logs` já existe. Adicionar `session_events(user_id, shop_id, event, ip, user_agent, created_at)` para login/logout/force_logout.
- RPC `admin_force_logout(_user_id, _shop_id)` — invalida refresh tokens via revoke em `auth.sessions` (via SECURITY DEFINER limitado a `owner/admin`).
- Página Team ganha aba "Auditoria" filtrada por colaborador.

## O que NÃO será feito
- Não criar segunda página de login, novo dashboard, novo ERP, nem duplicar Market.
- Não substituir `shop_users` por `user_roles` global — o projeto é multi-tenant por oficina, o role vive por oficina.
- Não tocar em Super Admin, Market realm, edge functions existentes, Stripe, PDFs, WhatsApp, email templates. Só **restringem-se** por role no fim (Fase 2 RLS já garante).
- Não introduzir libs novas.

## Ordem de execução (aprovação incremental)
1. **Fase 1** — migração enum + tabela profiles + funções `current_shop_role`/`has_capability` + hook `useShopRole` + `<Can>`. Testar Team com 5 roles.
2. **Fase 2** — views `_public` + policies financeiras. Ajustar leituras nas páginas afectadas.
3. **Fase 3** — redirect por role + Layout filtrado + form completo em Team + Workshop completo.
4. **Fase 4** — skills + scheduling engine v2.
5. **Fase 5** — auditoria + force logout.

Confirmo que cada fase é uma migração + um lote pequeno de UI, sem regressões, sem duplicação. Aprovas para começar pela **Fase 1**?
