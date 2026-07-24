
# GSN Fases 2–5 — Plano de Implementação

Todo o trabalho é **aditivo**, prefixado `gsn_`, protegido pela feature flag `supplier_network_enabled` (default `false`) e por RLS. Nenhum ficheiro do ERP, Market, Inventário, Oficina Filha, SEO, Convites ou Auth é alterado — apenas leituras pontuais para adicionar pontos de entrada opcionais (botão "Comprar Peças" em Orçamentos e ação "Adicionar ao stock" em Inventário, ambos por trás de `useSystemFeature("supplier_network_enabled")`).

## Fase 2 — Marketplace B2B (pesquisa e perfis)

Rotas novas (só para utilizadores autenticados de oficinas, gate `SupplierNetworkGate` + `RequireAuth`):
- `/parts` — pesquisa e listagem.
- `/parts/:productId` — detalhe do produto.
- `/parts/supplier/:supplierSlug` — perfil público do fornecedor.
- `/parts/favorites` — favoritos.
- `/parts/cart` — carrinho multi-fornecedor.

Backend:
- Índices `gin_trgm_ops` em `gsn_products (name, sku, ean, brand, model_compat)` para pesquisa rápida.
- RPC `gsn_search_products(q, filters jsonb, page, page_size)` com paginação + facets (marca, categoria, fornecedor, preço, stock, entrega).
- Nova tabela `gsn_favorites_products` (oficina ↔ produto) e `gsn_favorites_suppliers`.
- View `gsn_supplier_public` (campos seguros do fornecedor).

Frontend:
- `SearchBar` (debounce 250 ms), painel de filtros lateral, grelha de cartões, paginação infinita.
- Cartão de produto com botões: **Adicionar ao carrinho**, **Guardar favorito**, **Adicionar ao orçamento** (visível dentro do fluxo do orçamento).

## Fase 3 — Encomendas, Carrinho e Orçamentos

Reutiliza `gsn_orders`, `gsn_order_items`, `gsn_invoices` existentes; adiciona:
- `gsn_carts` e `gsn_cart_items` (por `shop_id`).
- `gsn_order_events` (auditoria de estado).
- Enum `gsn_order_status`: `cart, pending, paid, confirmed, preparing, shipped, partial, delivered, cancelled, refunded`.

RPCs atómicas:
- `gsn_cart_add / gsn_cart_update / gsn_cart_remove`.
- `gsn_cart_checkout` — divide o carrinho por `supplier_id` gerando N `gsn_orders` (uma por fornecedor), calcula subtotal/IVA/portes/desconto/comissão/total, cria items, marca `payment_status='pending'`.
- `gsn_order_transition(order_id, new_status)` — máquina de estados com validação de transições e escrita em `gsn_order_events`.
- `gsn_order_receive_to_inventory(order_id)` — opcional; devolve payload preparado para inserção no inventário existente (não escreve diretamente; o botão "Adicionar ao stock" chama a função de inventário atual).

Frontend:
- `/supplier-market/cart`, `/orders` (comprador) e páginas existentes do fornecedor recebem realtime + ações (Aceitar/Rejeitar/Tracking/Nota/Guia PDF).
- Integração leve no ERP: em `Quotes` (só leitura de UI, sem alterar lógica) mostra botão **Comprar Peças** que abre um Drawer com pesquisa; ao adicionar, guarda-se em `quote_metadata.gsn_items` — não altera schema de orçamentos.
- Em `Inventory`, após entrega, aparece toast "Adicionar ao stock?" que chama o fluxo de inventário existente com os campos preenchidos.

## Fase 4 — Pagamentos (arquitetura, sem cobrar) e Promoções

Sem implementar cobranças. Cria estrutura:
- Colunas em `gsn_suppliers`: `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`, `commission_rate` (default lido de `country_settings`).
- Tabela `gsn_payment_intents` (mirror local do estado Stripe: `pending/authorized/captured/failed/refunded`).
- Tabela `gsn_promotions` (fornecedor, tipo `percent|fixed`, valor, datas, limite, código opcional) e `gsn_promotion_redemptions`.
- Tabela `gsn_carrier_shipments` (tracking normalizado por transportadora) — apenas guarda dados, sem chamar APIs.
- Adapter TS `src/lib/gsn/payments/StripeConnectAdapter.ts` com métodos `createAccountLink`, `createPaymentIntent`, `capture`, `refund` — todos devolvem `NotImplementedError` mas com assinaturas estáveis.
- Adapters de faturação (`MoloniAdapter`, `InvoiceXpressAdapter`, `JasminAdapter`, `PrimaveraAdapter`, `PHCAdapter`) e distribuidores (`TecDocAdapter`, `LKQAdapter`, `BoschAdapter`, `DistrigoAdapter`, `ADPartsAdapter`, `EurorepAdapter`, `AutoPartnerAdapter`, `RestGenericAdapter`, `SoapGenericAdapter`) — todos sob interface comum `SupplierIntegrationAdapter`, sem implementação de rede.

Frontend fornecedor:
- Página `/supplier/promotions` (CRUD).
- Página `/supplier/payments` já existe; adiciona secção "Stripe Connect" com CTA `Ativar` (chama edge function stub que devolve `501 not_implemented` visível como "Em breve").

## Fase 5 — Painel Admin, Notificações, Segurança e Performance

Painel Admin (`/admin/supplier-network` expandido em subrotas):
- `dashboard` — receita, comissões, contagens, top fornecedores/produtos/oficinas (via views materializadas `gsn_admin_kpis_daily`).
- `suppliers`, `products`, `orders`, `payments`, `commissions`, `reviews`, `logs`, `complaints`, `carriers`, `settings`, `feature-flags`.
- Ações: suspender, bloquear, editar `commission_rate`, exportar CSV/Excel (client-side com `xlsx`).

Notificações (reutiliza tabela `notifications` existente + `email_queue`):
- Novo `gsn_notification_kind` enum (`order_new, payment_new, tracking_new, low_stock, product_approved, supplier_approved, promo`).
- Triggers em `gsn_orders`, `gsn_payment_intents`, `gsn_products.stock` enviam para `enqueue_email` + inserem `notifications` in-app.
- Push: reutiliza `push_subscriptions` existente (adapter novo `sendPushToUser`).

Segurança:
- RLS em TODAS as novas tabelas com `has_role` + `supplier_id = get_my_supplier_id()` para fornecedor, `shop_id in get_user_shop_ids()` para oficina, `has_role(auth.uid(),'super_admin')` para admin.
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role`; sem `anon`.
- Funções `SECURITY DEFINER` com `set search_path = public`.

Performance:
- Índices compostos (`supplier_id, status, created_at desc`), `pg_trgm` para pesquisa, view materializada de KPIs com refresh nightly.
- Paginação server-side (`page_size <= 50`), lazy loading de imagens, `React.Suspense` + `lazyRetry` para todas as rotas novas.

## Detalhes técnicos

Migração SQL (uma única, ordem obrigatória): CREATE TABLE → GRANT → ENABLE RLS → POLICIES → índices → triggers → RPCs.

Nova hook `useSupplierMarket()` centraliza `enabled = useSystemFeature("supplier_network_enabled")` + role do utilizador. Todos os pontos de entrada usam-no; quando `false`, renderizam `null` (nenhum flash).

Ficheiros novos (indicativo, sem alterar existentes fora dos dois pontos aprovados em Quotes e Inventory):
```text
src/pages/parts/{PartsSearch,PartDetail,SupplierPublic,PartsFavorites,PartsCart,PartsCheckout,PartsOrders,PartsOrderDetail}.tsx
src/pages/supplier/{SupplierPromotions,SupplierShipments,SupplierStripeConnect}.tsx
src/pages/admin/supplier/{Dashboard,Suppliers,Products,Orders,Payments,Commissions,Reviews,Logs,Complaints,Carriers,Settings,FeatureFlags}.tsx
src/components/parts/{SearchBar,FiltersPanel,ProductCard,CartDrawer,QuotePartsPicker}.tsx
src/hooks/{useSupplierMarket,useGsnCart,useGsnSearch,useGsnFavorites,useGsnOrders}.ts
src/lib/gsn/{payments,invoicing,carriers,suppliers}/*.ts  (adapters, stubs)
supabase/functions/gsn-checkout/index.ts               (chama RPC gsn_cart_checkout)
supabase/functions/gsn-stripe-connect/index.ts         (stub 501)
supabase/functions/gsn-notify/index.ts                 (dispatch email/push)
```

Nos dois pontos de integração no ERP, apenas se adiciona um bloco condicional `enabled && <NovoComponente/>` — nenhuma lógica existente é modificada.

## Ordem de execução

1. Migração SQL completa (tabelas, RLS, RPCs, índices, triggers, enums).
2. Hooks + adapters (sem UI).
3. Fase 2 UI (pesquisa, detalhe, perfil, favoritos).
4. Fase 3 UI (carrinho, checkout, orders, integração leve em Quotes e Inventory).
5. Fase 4 (promoções + stubs Stripe/faturação/carriers).
6. Fase 5 (admin panel + notificações + views KPI).
7. Typecheck (`tsgo`) e verificação de que rotas ficam ocultas com a flag desligada.

## Fora do âmbito (explicitamente não fazer)

- Cobrar pagamentos reais.
- Chamar APIs Stripe/Moloni/TecDoc/etc.
- Alterar schema de `quotes`, `parts`, `stock_movements`, `invoices`.
- Alterar RLS existente ou funções `has_role`, `get_user_shop_ids`.
- Alterar componentes ERP/Market fora dos dois pontos identificados.
