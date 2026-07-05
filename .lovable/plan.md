Vou dividir em 4 frentes independentes. Todas usam código existente sempre que possível.

## 1) Aprovação de Orçamentos/Serviços via link único (Email + WhatsApp)

**Backend**
- Migração: adicionar às tabelas `quotes` e `work_orders` (serviços) as colunas `approval_token uuid unique`, `approved_at timestamptz`, `approved_by_name text`, `approval_ip text`, `rejected_at timestamptz`, `reject_reason text`. Gerar token automaticamente via trigger `BEFORE INSERT` (default `gen_random_uuid()`).
- Nova policy pública (anon `SELECT`) restrita a linhas com token válido — filtro `USING (approval_token IS NOT NULL)` mas só através de RPC `get_public_approval(token uuid)` (SECURITY DEFINER) que devolve os dados necessários e nada do shop privado.
- RPC `approve_document(token uuid, name text, ip text)` e `reject_document(token uuid, reason text)` — SECURITY DEFINER, atualizam registo, gravam `audit_logs`.

**Frontend**
- Página pública `/approve/:token` (já existe `QuoteApproval.tsx` — estender para suportar quotes + services). Mostra: oficina, viatura, itens, total, botões Aprovar / Rejeitar, campo nome do cliente, disclaimer legal.
- Adicionar botões "Enviar link de aprovação" nos cartões/tabelas de Quotes e Services que:
  - Constroem URL pública `https://.../approve/<token>`.
  - Abrem WhatsApp com mensagem pré-preenchida (`openWhatsApp` existente).
  - Enviam email via `send-transactional-email` novo template `approval-request`.

## 2) Contabilidade GarageFlow (Painel Admin)

Nova página `/admin/accounting` (sidebar em "Sistema" ou nova secção "Contabilidade"):

**Filtros:** período (mês/trimestre/ano/personalizado) + botões de exportação CSV/PDF por relatório.

**Relatórios (dados apenas do SaaS, não das oficinas):**
1. Faturação GarageFlow — de `payments` + `subscriptions`.
2. Subscrições ativas — `subscriptions where status='active'`.
3. Pagamentos recebidos — `payments where status='paid'`.
4. Pagamentos pendentes — `payments where status in ('pending','failed')`.
5. Reembolsos — `payments where amount<0 or status='refunded'` (usar Stripe API se necessário).
6. MRR / ARR — soma dos preços das subscrições ativas × 1 (MRR) e ×12 (ARR).
7. IVA liquidado/recebido — 23% PT sobre valor líquido dos pagamentos EU (usar `country` do shop).
8. Receita por plano — group by `plan`.
9. **SAF-T PT (GarageFlow SaaS)** — XML gerado com dados da empresa (constantes `GARAGEFLOW_COMPANY_*` num ficheiro config) + faturas de subscrição. Aviso claro "Software não certificado pela AT".

Reaproveitar `CommercialReports.tsx` como base para CSV/PDF export.

## 3) Sincronizar preço plano Admin ↔ Landing ↔ Billing

Diagnóstico: `AdminPlans` grava em `plans` table mas Landing e `Billing` usam preços hardcoded ou `country_settings`.

**Fix:**
- Landing (`LandingPage.tsx`) já ouve `plans` realtime — verificar campo consultado; se está a ler `plans.price_monthly` mas admin grava noutra coluna, alinhar.
- `Billing.tsx` (oficina logada) — trocar valores hardcoded por leitura de `plans` (com fallback ao `country_settings` só se `plans` vazio).
- Garantir que `AdminPlans` grava e emite realtime event; adicionar `channel.subscribe` na Landing + Billing (invalidação de cache).

## 4) Uniformização de tabelas ao estilo Veículos

Padrão de referência atual em `Vehicles.tsx`: `<Table>` shadcn + `<div className="w-full">` sem container `max-w-*`, colunas com `truncate` e larguras `w-*`, dual-view mobile (`sm:hidden` cards).

Aplicar a: `Services.tsx`, `Quotes.tsx`, `Workshop.tsx` (reparações), `Invoices.tsx`, `Clients.tsx`, `Stock.tsx`, `Warranties.tsx`, `Appointments/Agenda.tsx`.

**Regras técnicas:**
- Remover `overflow-x-auto` do wrapper da página; manter apenas dentro de `<Table>` (shadcn já faz isso via `relative w-full overflow-auto`).
- Container da página: `w-full` sem `max-w-*`.
- Colunas com `min-w-0 truncate` + `title={value}` para tooltip.
- Botões de ação em coluna sticky à direita OU dropdown `MoreHorizontal` se >3 ações.
- Mobile <640px: cartões (`sm:hidden`), com todas as informações e ações visíveis (sem esconder nada).
- Nenhuma coluna oculta: campos longos ficam com truncate + tooltip, nunca `display:none`.

## Ordem de execução
1. Sincronizar preço (rápido, alto valor visível) — 1 iteração.
2. Uniformizar tabelas — 1 iteração (várias páginas em paralelo).
3. Aprovação por link — 1 iteração (migração + página + botões).
4. Contabilidade GarageFlow + SAF-T — 1 iteração (nova página admin + export).

## Detalhes técnicos

- Migrações SQL separadas para (a) approval tokens e (b) index/optimizações.
- Novo edge function `send-approval-link` (opcional — pode ser chamada direta do frontend com `send-transactional-email`).
- SAF-T PT: template XML mínimo (Header + MasterFiles.Customer + SourceDocuments.SalesInvoices). Marcar `<TaxRegistrationNumber>` da GarageFlow (constante). Sem certificação AT — obrigatório disclaimer.
- Dados da empresa GarageFlow (NIF, morada, capital social) precisam ser guardados — proponho tabela `platform_company_info` (single row) editável em `/admin/settings`.

## Perguntas
- **NIF/morada/dados fiscais do GarageFlow** para o SAF-T: prefere que eu crie a UI em Admin → Configurações para preencheres, ou já tens os dados para eu meter hardcoded no config?
- **Aprovação:** deve exigir assinatura digital (canvas) como já existe em `SignaturePad.tsx`, ou basta nome + checkbox de aceitação?