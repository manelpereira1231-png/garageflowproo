
# Planos 100% dinâmicos — plano de refactor

## Objetivo
Uma única fonte de verdade (`plans` + `plan_features` + `plan_country_prices` + `plan_promotions`). Qualquer plano criado no Super Admin aparece automaticamente em Landing, Billing, Upgrade, Checkout Stripe, Países, Promoções, Feature Matrix, JSON-LD e RBAC — sem alterar código nem manter listas de slugs.

## Auditoria (locais com hardcode confirmados)

Frontend
- `src/lib/platformSettings.ts` — `PlanLimitsRow` por slug (`free/pro/garage`), `planFeatureKeysFor`, `limitOverridesFor` com `if plan === "pro" / "garage"`.
- `src/lib/features.ts` — `FALLBACK_PLAN_FEATURES`, `GARAGE_ONLY_FEATURES`, ramos legacy.
- `src/hooks/useSubscription.ts` — `PLAN_LIMITS` hardcoded, `LegacyPlan`, fallback por slug.
- `src/components/FeatureGate.tsx` / `PlanGate.tsx` — prop `requiredPlan?: "pro" | "garage"` + comparação por slug.
- `src/pages/Billing.tsx` — array `[{ key: "pro" }, { key: "garage" }]`, ícones e cores fixos, botões condicionados por slug.
- `src/pages/LandingPage.tsx` (tabela de preços) — cartões manuais por plano.
- `src/pages/admin/AdminPlans.tsx` — parcialmente dinâmico, falta secção "Stripe IDs por país" + trial.
- `src/pages/admin/*Countries*`, `AdminPromotions*` — assumem 3 planos fixos nas colunas/rows.
- `src/pages/Dashboard.tsx`, `src/pages/PartnersPortal.tsx`, `src/pages/Auth.tsx` — `plan === "garage"`, `plan_offer === "pro"`, `account_type: "pro"`.

Backend (edge functions + SQL)
- `supabase/functions/stripe-webhook/index.ts` — mapa `amount → slug` (9900→garage, 4900→pro).
- `supabase/functions/generate-alerts/index.ts` — `if (shop.plan !== "garage")`, quotas por slug.
- `supabase/functions/partner-automation/index.ts` — `sub.plan === "pro" ? 99 : 49`.
- `supabase/functions/create-checkout/index.ts` — precisa ler `plan_country_prices` (já parcialmente feito).
- Trigger SQL `handle_new_shop_subscription` — herda por prioridade fixa Garage>Pro>Start>Free.

Fora de âmbito (não são planos ERP): `MarketDealerDashboard` (planos do Market — outro produto).

## Modelo de dados (extensões mínimas)

Adicionar à tabela `plans` (se em falta):
- `sort_order int`, `is_public bool`, `icon text`, `accent text` (cor tailwind semântica), `trial_days int`, `is_default bool`, `supports_multi_shop bool`, `included_shops int`.

Nova tabela `plan_limits(plan_id, key text, value_int int, value_bool bool)`:
- Chaves: `max_shops`, `max_users`, `max_vehicles`, `max_clients`, `max_services_per_month`, `max_storage_mb`, `max_api_calls_per_day`, `max_quotes_per_month`, etc.
- Único índice `(plan_id, key)`. GRANT + RLS (leitura pública, escrita só super_admin).

Estender `plan_country_prices` (colunas em falta):
- `stripe_product_id`, `stripe_price_monthly`, `stripe_price_yearly`, `promo_stripe_coupon_id`, `trial_days_override`.

Nova coluna em `plans`: `default_stripe_product_id` (fallback global quando país não tem override).

Backfill: seed dos 3 planos atuais (start/pro/garage) com todos os valores atuais, para que a app continue idêntica.

## Camada de acesso única

Novo hook `src/hooks/usePlansCatalog.ts` (react-query, cache global 5 min):
- Retorna `plans[]` já unidos com `features[]`, `limits{}`, `prices{country}`, `promotion{country}`.
- Uma única query, invalidação por realtime em `plans` e `plan_features`.

Utilitário puro `src/lib/plans.ts`:
- `resolvePlanBySlug(catalog, slug)`
- `hasFeature(plan, featureSlug)` — lê `plan.features`
- `getLimit(plan, key, fallback?)` — lê `plan.limits`
- `comparePlans(a, b)` — usa `sort_order`, nunca slug
- `planSatisfies(current, required)` — via `sort_order >= required.sort_order`, sem "pro/garage"

## Passos de execução

1. **Migração SQL** (schema + backfill + GRANTs + RLS + trigger `set_updated_at`).
2. **Camada dados**: `usePlansCatalog`, `lib/plans.ts`, remover `PLAN_LIMITS` de `useSubscription`, refazer `features.ts` sem fallback por slug (a fonte é sempre BD; se BD vazia → sem features, mostra loading).
3. **Gates**: `FeatureGate`/`PlanGate` passam a receber `requiredFeature` ou `requiredSortOrder` (int) em vez de `requiredPlan`. Substituir todos os call-sites com codemod (`sort_order` do plano requerido lido do catálogo, não escrito no JSX).
4. **Admin**:
   - `AdminPlans`: CRUD completo (metadados + limites dinâmicos + features + `stripe_product` global).
   - `AdminCountries`: gera colunas dinamicamente a partir de `plans` (map + reduce), edição de `stripe_price_monthly/yearly` por plano/país.
   - `AdminPromotions`: seletor de plano é `<Select>` populado do catálogo.
5. **Billing / Upgrade / LandingPage pricing**: renderizam `catalog.plans.filter(p => p.is_public).sort_by(sort_order)`. Um único `<PlanCard>` reutilizado. Ícone/cor vêm de `plan.icon/accent`.
6. **Checkout**: `create-checkout` recebe `plan_slug` + `interval` + `country` e faz lookup em `plan_country_prices` → Stripe Price ID; se ausente cai para `plans.default_stripe_product_id`. Sem switch.
7. **stripe-webhook**: identificar plano por `price.id` via `plan_country_prices` reverse lookup (não por valor). Fallback: `product.metadata.plan_slug`.
8. **generate-alerts / partner-automation**: quotas via `getLimit(plan, "…")` e comissões via `plan.limits.partner_commission_rate` (novo limite). Sem `if plan === "garage"`.
9. **Trigger `handle_new_shop_subscription`**: em vez de prioridade Garage>Pro>Start, ordena por `sort_order desc` na query — herda o plano mais alto que o dono já tem.
10. **SEO**: `LandingPage` gera JSON-LD `Offer[]` iterando o catálogo. `SoftwareApplication.offers` idem.
11. **Multi-oficina**: `check_shop_creation_limit` RPC passa a ler `plan_limits.max_shops` em vez de comparar slug.
12. **Validação**: criar plano "Enterprise" via Admin (sort_order 40, max_shops 20, todas features on) e verificar que aparece em Landing/Billing/Upgrade/Checkout/Países/Promoções/JSON-LD sem alterar código.

## Estratégia de rollout / não-regressão

- Backfill mantém `start/pro/garage` com valores 1:1 aos atuais → comportamento externo idêntico.
- `useSubscription.plan` continua a devolver string (o slug real da BD), mas nenhum consumidor compara por string; comparam por `sort_order`/`features`/`limits`.
- Manter export `LegacyPlan` como `string` (deprecated) para não quebrar imports; remover num passe seguinte.
- Testes manuais: signup + upgrade + downgrade + checkout Stripe (test mode) + limite de oficinas + FeatureGate.

## Estimativa
Migração + 4 hooks/libs + 8 páginas + 4 edge functions. ~1 iteração grande.

## Confirmação pedida
1. Aceitas criar as duas novas tabelas (`plan_limits`) e as colunas extra em `plans`/`plan_country_prices`?
2. Aceitas que `FeatureGate`/`PlanGate` deixem de aceitar `requiredPlan="pro"|"garage"` e passem a exigir `requiredFeature` (recomendado) ou `minSortOrder`?
3. Confirmas que o Market (`MarketDealerDashboard`) fica fora — é catálogo de planos do Market, não do ERP?

Assim que aprovares, executo tudo numa passagem.
