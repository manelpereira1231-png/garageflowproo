# GarageFlow Supplier Network (GSN) — Fase 1

Módulo B2B de fornecedores de peças, 100% isolado, invisível até o Super Admin ativar o feature flag. Nenhuma funcionalidade existente é alterada.

## Âmbito da Fase 1 (única a implementar agora)

Só entra código para: estrutura de BD, papel Supplier, autenticação/sessão Supplier, dashboard Supplier, CRUD fornecedores, CRUD produtos, feature flag, menu Admin, RLS, arquitetura preparada. Marketplace B2B, encomendas, pagamentos Stripe Connect e integrações externas ficam **fora** desta fase (só ficam interfaces/tabelas mínimas para não obrigar refactor futuro).

## Regras invioláveis

- Nada removido do ERP, Marketplace de carros, Inventário, Financeiro, Oficina Filha, SEO, Convites, RLS, Auth.
- Todos os ficheiros novos vivem em pastas próprias (`src/pages/supplier/`, `src/pages/admin/supplier-network/`, `src/components/supplier/`, `src/hooks/supplier/`, `src/lib/supplier/`, `supabase/functions/supplier-*`).
- Sem alterações a hooks/páginas existentes exceto:
  - `src/App.tsx` — registar novas rotas atrás do flag.
  - `src/components/AdminLayout.tsx` (ou equivalente da sidebar admin) — adicionar entrada "Supplier Network" visível **apenas** a Super Admin.
- Design, tema, tipografia e padrões visuais existentes reutilizados 1:1 (shadcn + tokens semânticos).

## Feature Flag

- Nova tabela `public.system_features (key text pk, enabled bool, updated_at, updated_by)`.
- Seed: `('supplier_network_enabled', false)`.
- Hook `useSystemFeature('supplier_network_enabled')` com realtime.
- Enquanto `false`: rotas devolvem 404, menus ocultos, endpoints das edge functions respondem 403.
- Super Admin vê sempre (bypass), independentemente do flag — para poder testar antes de ligar.

## Base de dados (migração única)

Todas as tabelas em schema `public`, com `GRANT`s + RLS + policies + trigger `updated_at`.

Tabelas:

1. `system_features` — flag global.
2. `suppliers` — todos os campos do prompt (company_name, trade_name, vat_number, email, phone, website, country, district, city, postal_code, address, logo_url, banner_url, description, average_delivery_time, minimum_order, active, approved, commission_percentage default 5, stripe_account_id, subscription_plan, subscription_status, rating_average default 0, rating_count default 0, support_email, support_phone, pickup_available, delivery_available, owner_user_id fk auth.users, deleted_at para soft delete).
3. `supplier_products` — todos os campos do prompt (supplier_id fk, sku, manufacturer_reference, ean, brand, model, category, subcategory, title, description, technical_description, compatibility jsonb, weight, length, width, height, stock int check >=0, reserved_stock int check >=0 default 0, price numeric, discount_price numeric, vat numeric, currency default 'EUR', status enum draft/active/archived, condition enum new/refurbished/used, image, gallery jsonb, datasheet, manual_pdf, deleted_at). Constraint: `reserved_stock <= stock`.
4. `supplier_stock_movements` — histórico (product_id, type enum in/out/reserve/release/adjust/inventory, quantity, reason, created_by, created_at).
5. `supplier_categories` — árvore (id, parent_id, slug, name, active).
6. **Stubs preparados** (schema mínimo, RLS restritiva, sem UI nesta fase): `supplier_orders`, `supplier_order_items`, `supplier_payments`, `supplier_invoices`, `supplier_reviews`, `supplier_favorites`, `supplier_coupons`, `supplier_carriers`. Ficam vazias mas evitam refactor nas Fases 2-4.

RBAC:
- Novo enum `app_role` já existe → adicionar valor `'supplier'` (ALTER TYPE).
- Não confundir com `shop_users` — supplier autentica via `auth.users` + row em `user_roles` com role `supplier` + row em `suppliers.owner_user_id`.

RLS (todas as tabelas):
- `suppliers`: SELECT/UPDATE próprios via `owner_user_id = auth.uid()`; INSERT bloqueado no client (só via edge function ou Admin); Super Admin ALL.
- `supplier_products` e stock: SELECT/INSERT/UPDATE/DELETE apenas onde `supplier_id` pertence ao supplier autenticado; Super Admin ALL.
- Oficinas (`authenticated` não-supplier) **não** ganham SELECT em nada nesta fase — Marketplace B2B fica para Fase 2.
- Stubs (orders, payments, reviews…): policies fechadas a supplier próprio + Super Admin; sem exposição a oficinas.

## Autenticação Supplier

- Login em `/supplier/login` (página nova, tema idêntico ao `/auth`).
- Cliente Supabase próprio (`src/integrations/supabase/supplier-client.ts`) com `storageKey` isolado (`gf-supplier-auth`), no padrão dos Realm-Isolated Clients já usados no projeto (ERP vs Market).
- Sessão nunca colide com sessão ERP/Market.
- Signup **fechado**: só Admin cria fornecedor + envia convite (edge function `supplier-invite` que gera link via `auth.admin.generateLink` e enfileira e-mail via `enqueue_email` — mesmo padrão dos convites de Oficina Filha, sem tocar no fluxo existente).
- `/supplier/accept-invite` + `/supplier/reset-password` (isolados, não reutilizam ResetPassword do ERP).

## Dashboard Supplier (`/supplier/*`)

Layout próprio `SupplierLayout` (sidebar + topbar reutilizando componentes shadcn):

- `/supplier` — KPIs: receita hoje/mês/ano (0 nesta fase, placeholders reais a partir de `supplier_orders` mesmo vazias), encomendas, stock baixo, produtos ativos, sem stock, top produtos, últimas encomendas, últimos pagamentos, avaliação média.
- `/supplier/products` — lista + criar/editar/duplicar/arquivar/eliminar (soft delete), importar/exportar CSV e Excel, múltiplas imagens, PDF ficha técnica, compatibilidades.
- `/supplier/categories` — gestão da própria árvore.
- `/supplier/stock` — histórico de movimentos, ajustes, inventário.
- `/supplier/orders`, `/supplier/customers`, `/supplier/payments`, `/supplier/carriers`, `/supplier/invoices`, `/supplier/reviews` — páginas presentes com estado vazio profissional ("Disponível na próxima fase") para não quebrar navegação nem o menu completo definido no prompt.
- `/supplier/profile` — dados públicos do fornecedor.
- `/supplier/settings` — conta, notificações, preferências.

Uploads via Supabase Storage: buckets novos `supplier-logos`, `supplier-banners`, `supplier-products` (policies por `owner_user_id`).

## Admin — Supplier Network

Rota nova `/admin/supplier-network` visível **só** a Super Admin, com submenus do prompt:
Dashboard, Fornecedores (aprovar/suspender/bloquear/eliminar/alterar comissão), Produtos, Encomendas, Pagamentos, Comissões, Avaliações, Transportadoras, Logs, Configurações, Feature Flags.

Página de Configurações inclui o **toggle "Ativar Supplier Network"** que escreve em `system_features`.

## Edge Functions novas

- `supplier-invite` — cria row em `suppliers` + user + convite.
- `supplier-resend-invite`.
- `supplier-products-import` — parse CSV/XLSX server-side.
- `supplier-products-export`.

Todas verificam:
1. Flag ativo **ou** caller é Super Admin.
2. Role correto.
3. Rate limit (usa `check_rate_limit` já existente).

## Rotas / Menu

- `App.tsx`: adiciona `<Route path="/supplier/*">` e `<Route path="/admin/supplier-network/*">`, ambas atrás de `SupplierNetworkGate` (flag + role).
- Fora de `/supplier` e `/admin/supplier-network`, **nenhum** menu do ERP/Market ganha entradas novas.

## Segurança / Performance

- Índices: `supplier_products(supplier_id, status)`, `supplier_products(sku)`, `supplier_products(ean)`, GIN em `title || description` para pesquisa futura, `supplier_stock_movements(product_id, created_at desc)`.
- Soft delete (`deleted_at`) em `suppliers` e `supplier_products`.
- Audit log em `audit_logs` (tabela já existe) para ações admin.
- Realtime opcional em `supplier_products` e `system_features`.

## Verificação final

1. Flag OFF + user comum: `/supplier/*` e `/admin/supplier-network/*` → 404; nenhum menu extra visível; ERP/Market/Admin idênticos ao atual.
2. Flag OFF + Super Admin: consegue entrar em `/admin/supplier-network` e alternar o flag.
3. Flag ON + supplier autenticado: entra no dashboard próprio, CRUD produtos funciona, RLS impede ver outro fornecedor.
4. `tsgo` limpo, build limpo, sem regressões em rotas existentes.

## Detalhes técnicos (secção separada)

- Migração SQL única com 4 passos (CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY) por cada tabela nova, conforme regra do projeto.
- `has_role(auth.uid(),'supplier')` reutiliza função existente após ALTER TYPE.
- Cliente Supplier: mesmo padrão de `realmClients.ts`; nunca importar `@/integrations/supabase/client` dentro de páginas `/supplier`.
- Todos os componentes UI reutilizam tokens semânticos do `index.css` — zero cores hardcoded.
- Nomes internos usam sempre "Supplier Network"; UI em PT-PT ("Rede de Fornecedores").
