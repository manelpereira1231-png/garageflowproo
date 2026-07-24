
# Supplier Onboarding Profissional — Plano

Módulo 100% aditivo. Não toca em ERP, Market, Inventário, Oficina Filha, SEO existente, Auth, RLS existente, nem menus atuais. Toda a lógica nova vive sob "Supplier Network" e respeita `supplier_network_enabled`.

## 1. Base de dados (migração aditiva)

Sem alterar tabelas existentes; apenas colunas novas em `gsn_suppliers` e uma tabela nova.

- Novo enum `gsn_supplier_state`: `invited | pending | pending_approval | approved | rejected | suspended | blocked`.
- `gsn_suppliers` — colunas novas (nullable, defaults seguros):
  - `state gsn_supplier_state default 'approved'` (retrocompatível: registos atuais ficam `approved`).
  - `application_source text` (`invite | public | manual`).
  - `rejection_reason text`, `approved_at`, `approved_by`, `invited_at`, `invited_by`.
  - `docs jsonb default '{}'` (certidão, IVA, logótipo, banner, catálogo — cada um `{url,status}`).
- Nova tabela `gsn_supplier_invites` (token único, email, payload de pré-registo, `expires_at`, `used_at`).
- Nova tabela `gsn_supplier_applications` (candidaturas públicas antes de terem `owner_user_id`): empresa, responsável, contactos, NIF, morada, categorias, marcas, transportadoras, tempo entrega, estado, motivo rejeição, `created_supplier_id`.
- GRANTs + RLS:
  - `gsn_supplier_invites`: só super admin lê/escreve; leitura por token via RPC `SECURITY DEFINER`.
  - `gsn_supplier_applications`: `INSERT` público (rate-limited via `check_rate_limit`), `SELECT/UPDATE` só super admin.
  - Regras existentes de `gsn_suppliers` mantidas; adiciona política que impede o próprio supplier de mudar `state`, `commission_percentage`, `approved`.

## 2. Gating de acesso (backend + frontend)

- RPC `gsn_current_supplier_state()` retorna estado do supplier do utilizador.
- `useIsSupplier` estendido → devolve `{ isSupplier, state, loading }` sem alterar chamadas atuais (campos novos opcionais).
- Novo componente `SupplierApprovalGate` embrulha rotas `/supplier/*` (exceto `setup`, `login`, `pending`):
  - `approved` → passa.
  - `invited | pending | pending_approval` → redireciona para `/supplier/pending` (nova página "candidatura em análise").
  - `rejected | suspended | blocked` → página dedicada com motivo.
- RLS reforçado: policies de `gsn_products`, `gsn_stock_movements`, `gsn_orders` etc. já filtram por `supplier_id`; adiciona-se `USING` extra para exigir `state = 'approved'` via função `has_approved_supplier(uid)` (SECURITY DEFINER, sem recursão).

## 3. Modo 1 — Convite Manual (Admin)

- Em `AdminSupplierNetwork.tsx`: novo botão "Convidar Fornecedor" (modal com campos pedidos).
- Ação cria linha em `gsn_supplier_invites` + envia email via `send-transactional-email` template novo `supplier-invite`.
- Página pública `/supplier/setup?token=…`:
  - Valida token via RPC `gsn_accept_invite(token, password)`.
  - Cria user (`supabase.auth.signUp`), cria/atualiza `gsn_suppliers` com dados do convite, estado `pending_approval`, marca token `used_at`.
  - Redireciona para `/supplier/pending`.

## 4. Modo 2 — Candidatura Pública

- Nova página `/fornecedores` (landing profissional, mesmo design system) com CTA.
- `/fornecedores/candidatura` com formulário validado por Zod.
- `INSERT` em `gsn_supplier_applications` (estado `pending`).
- Email confirmação candidatura + email admin nova candidatura.
- Se `supplier_network_enabled = false`: form mostra aviso "aceitamos apenas por convite".

## 5. Admin — Supplier Applications

- Nova secção em `/admin/supplier-network/applications` (rota nova, item novo no submenu admin — não altera menus existentes de utilizadores).
- Tabs: Novas / Pendentes / Aprovadas / Rejeitadas.
- Ações: Ver, Aprovar, Rejeitar (com motivo), Pedir Informação (email livre).
- Aprovar → RPC `gsn_approve_application(app_id)`:
  - Cria supplier com estado `approved`, gera magic link/reset password, envia email `supplier-approved`.
- Rejeitar → estado `rejected` + email `supplier-rejected` com motivo.

## 6. Dashboard cards (Admin)

- Em `AdminSupplierNetwork.tsx` adicionar cards de KPI (total, por estado, novas este mês, receita/comissões) usando queries agregadas — sem mexer no layout do resto da página.

## 7. Emails (React Email templates)

Novos templates em `supabase/functions/_shared/transactional-email-templates/`:
- `supplier-invite`
- `supplier-application-received`
- `supplier-application-info-request`
- `supplier-approved`
- `supplier-rejected`
- `supplier-suspended`

Registados em `registry.ts`. Um único trigger por evento (transacional, não marketing).

## 8. Notificações in-app

Usa tabela `notifications` existente (não altera schema). Insere notificações para super admins em novos eventos.

## 9. SEO da landing `/fornecedores`

`<Helmet>` com título, descrição, OG, Twitter, JSON-LD `FAQPage` + `Organization`. Não altera SEO existente.

## 10. Feature Flag

- `/fornecedores` sempre acessível (SEO), mas submissão bloqueada quando flag off (mensagem "só por convite").
- `/admin/supplier-network/*` já protegido por Super Admin.
- Dashboards supplier já protegidos por `SupplierNetworkGate` + novo `SupplierApprovalGate`.

## 11. Arquitetura futura (stubs, sem UI)

Interfaces TypeScript em `src/lib/gsn/onboarding/`:
- `StripeConnectOnboarding`, `SupplierSubscriptionAdapter`, `SupplierPayoutAdapter`, `PublicApiKeyIssuer`.
Implementações vazias (`throw not_implemented`) — só contratos.

## 12. Rotas novas

Registadas em `src/App.tsx` (aditivo):
- `/fornecedores` (público)
- `/fornecedores/candidatura` (público)
- `/supplier/setup` (público, com token)
- `/supplier/pending` (autenticado)
- `/admin/supplier-network/applications` (super admin)

`/supplier/login` já existe via `/auth` — reutilizado, não duplicado.

## 13. Garantias de não-regressão

- Registos `gsn_suppliers` existentes default `approved` → nenhum supplier atual é bloqueado.
- Nenhuma policy existente é DROPPED; apenas `CREATE POLICY … FOR …` novas e `ALTER TABLE ADD COLUMN`.
- Nenhum menu, rota, ou componente existente é modificado exceto:
  - `AdminSupplierNetwork.tsx`: adiciona botão "Convidar" e cards KPI (sem remover nada).
  - `useIsSupplier.ts`: adiciona campo opcional `state`.
  - `App.tsx`: adiciona rotas.
- Typecheck após cada bloco.

## Detalhes técnicos

```text
Fluxo Convite:
Admin ── invite ──► gsn_supplier_invites (token) ──► email
   Fornecedor abre /supplier/setup?token=…
   RPC gsn_accept_invite → cria auth user + gsn_suppliers(state=pending_approval)
   Admin aprova → state=approved → email

Fluxo Público:
Visitante /fornecedores ──► form /fornecedores/candidatura
   INSERT gsn_supplier_applications(state=pending)
   Admin aprova → cria auth user + gsn_suppliers(state=approved) + reset password email
```

Gating (RLS chave):
```sql
create or replace function public.gsn_supplier_is_approved(_uid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from gsn_suppliers
                 where owner_user_id=_uid and state='approved' and deleted_at is null);
$$;
```
Usada em `USING` de policies de write em `gsn_products`, `gsn_stock_movements`, etc. (aditiva, combinada com AND às existentes via nova policy paralela — as antigas mantêm-se).

Confirma para arrancar (migração SQL primeiro; depois emails, páginas públicas, admin apps, gating).
