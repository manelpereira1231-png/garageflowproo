# Planos 100% Dinâmicos — Enterprise, Sem Regressões

## Princípio

Uma única fonte de verdade: tabelas `plans`, `plan_features`, `plan_limits_catalog` (nova, para descrever os *tipos* de limites configuráveis) e `plan_country_prices`. Nenhum código compara slug (`plan === "garage"`). Toda a UI itera o catálogo. Todos os limites são **numéricos** (`-1` = ilimitado, `0` = sem acesso, `N` = quota).

## O que muda

### 1. Base de dados

**`plan_limits_catalog`** (nova) — define os limites disponíveis no sistema, editáveis pelo Super Admin:

| coluna | tipo | descrição |
|---|---|---|
| key | text PK | ex: `max_shops`, `max_users`, `max_ai_credits` |
| label | text | "Oficinas máximas" |
| description | text | ajuda inline |
| unit | text | `count`, `gb`, `per_month`, `boolean` |
| category | text | `limits`, `channels`, `ai`, `access` |
| sort_order | int | |

Seed com: `max_shops, max_users, max_clients, max_vehicles, max_work_orders_month, max_quotes_month, max_services_catalog, max_products_stock, max_storage_gb, max_api_calls_month, max_ai_credits_month, max_sms_month, max_emails_month, max_whatsapp_month, max_campaigns, max_automations, max_team_members, marketplace_access, partner_commission_rate`.

**`plans.limits jsonb`** — já existe. Passa a conter todos os limites por chave: `{"max_shops": 5, "max_users": -1, "marketplace_access": 1, ...}`. `-1` = ilimitado.

**`plan_features`** — sem alterações estruturais; matriz plano × feature (on/off) permanece.

**Backfill**: escrever para os 3 planos actuais os valores iguais aos existentes (`start: max_shops=1, max_users=1`, `pro: max_shops=1, max_users=5`, `garage: max_shops=5, max_users=-1`, etc.), garantindo zero regressão comportamental.

**`check_shop_creation_limit`** RPC: passa a ler `plan.limits->>'max_shops'` em vez de comparar slugs.

**Trigger `handle_new_shop_subscription`**: ordena os planos do dono por `sort_order desc` e herda o mais alto (elimina prioridade fixa Garage>Pro>Start).

### 2. Camada de acesso (frontend)

- `usePlansCatalog` (já existe) — mantém-se, é a fonte única.
- `planLimit(plan, key)` — já existe; passa a ser o único caminho para ler limites.
- `useSubscription`: remove `PLAN_LIMITS` hardcoded. `canUseFeature(key)` passa a delegar em `hasFeature(currentPlan, featureSlug)` (matriz) OU `planLimit(currentPlan, key) > 0`.
- `src/lib/features.ts`: remove `FALLBACK_PLAN_FEATURES` e `GARAGE_ONLY_FEATURES`. Fonte = BD.
- `src/lib/platformSettings.ts`: `limitOverridesFor` / `planFeatureKeysFor` deprecados — passam a delegar no catálogo dinâmico via wrapper (mantém-se export para não quebrar imports; internamente lê o catálogo).
- `FeatureGate` / `PlanGate`: aceitam nova prop `requiredFeature: string` OU `minSortOrder: number`. `requiredPlan="pro"|"garage"` fica deprecado mas continua a funcionar (resolve para `sort_order` do slug via catálogo, com fallback seguro).

### 3. Admin — `/admin/plans`

Reconstruído com três secções por plano:

**Metadados**: nome, slug, descrição, cor, ícone, `sort_order`, `active`, `visible_on_landing/billing/checkout/compare`, `trial_days`, `is_recommended`.

**Limites** (renderizado dinamicamente a partir de `plan_limits_catalog`): para cada entrada do catálogo, mostra um campo numérico (ou toggle se `unit=boolean`) editando `plans.limits[key]`. `-1` = ilimitado (checkbox "∞"). **Multi-Oficina passa a ser `max_shops` numérico**, conforme pedido.

**Preços por país** (`plan_country_prices`): tabela editável com colunas `country_code, currency, monthly_amount, yearly_amount, stripe_product_id, stripe_price_monthly, stripe_price_yearly, promo_stripe_coupon_id, trial_days_override`.

**Features** (matriz): checkboxes por feature (linhas da tabela `features`), gravando em `plan_features`.

### 4. Admin — Countries / Promoções / Feature Matrix

- `AdminCountries`: colunas geradas por `catalog.plans.map(...)` — qualquer plano novo cria coluna automaticamente.
- `AdminPromotions`: seletor de plano populado do catálogo.
- `AdminFeatureMatrix`: colunas e linhas 100% do catálogo + tabela `features`.

### 5. Landing / Billing / Upgrade / Checkout

- `LandingPage` pricing e `Billing`: já iteram `publicPlans(catalog, ...)` (feito na fase anterior). Confirmar que **um único `<PlanCard>`** é reutilizado, ícone/cor vêm de `plan.icon/color`.
- `create-checkout` edge function: lookup em `plan_country_prices` por `(slug, country, cycle)` → `stripe_price_id`. Fallback: `plans.stripe_product_id` global. Sem switch por slug.
- JSON-LD (SEO): gera uma `Offer` por plano do catálogo.

### 6. Edge Functions

- `stripe-webhook`: identificar plano por `price.id` em `plan_country_prices` (reverse lookup); fallback `product.metadata.plan_slug`. Remove mapa `amount → slug`.
- `generate-alerts`: quotas via `planLimit(plan, "max_alerts_month")` (adiciona ao catálogo). Remove `if (shop.plan !== "garage")`.
- `partner-automation`: comissão via `planLimit(plan, "partner_commission_rate")` (novo limite). Remove ternário `sub.plan === "pro" ? 99 : 49`.
- `run-automations` / `send-*`: consomem `max_sms_month`, `max_emails_month`, `max_whatsapp_month` via catálogo (enforcement via contadores).

### 7. Compatibilidade

Backfill garante `start / pro / garage` com valores idênticos aos actuais → comportamento externo inalterado. Testes manuais: signup, upgrade, downgrade, checkout Stripe (test mode), limite de oficinas, FeatureGate em rotas Garage-only.

## Fora de âmbito

- Design/layout/UX inalterados.
- Marketplace `market_enabled` kill-switch inalterado.
- RLS / RBAC / Onboarding / Multi-Oficina lógica de isolamento inalterada.
- Market (Carity) — catálogo próprio, não tocado.

## Execução

1. Migração SQL (catálogo de limites + backfill de `plans.limits` + RPCs + trigger).
2. Refactor `useSubscription`, `features.ts`, `platformSettings.ts` para consumir catálogo.
3. Reconstrução `AdminPlans` com secção "Limites" gerada dinamicamente.
4. `AdminCountries`, `AdminPromotions`, `AdminFeatureMatrix` — colunas dinâmicas.
5. Edge functions: `stripe-webhook`, `generate-alerts`, `partner-automation` — remover hardcodes.
6. Validação: criar plano fictício "Enterprise" no Admin com `max_shops: 20`, todas features ON, e confirmar aparição automática em Landing, Billing, Upgrade, Checkout, Countries, Promotions, Feature Matrix, JSON-LD.

## Confirmação

Aprovas esta abordagem? Em particular:
1. Criação da tabela `plan_limits_catalog` (descreve os *tipos* de limites disponíveis, editável no Admin).
2. `FeatureGate`/`PlanGate` mantêm `requiredPlan` como deprecated (resolve via catálogo) — evita reescrever ~30 call-sites.
3. Backfill mantém start/pro/garage 1:1 aos valores actuais.
