---
name: Enterprise AI Cost Control
description: Sistema completo de controlo de custos IA (orçamento global, cache, rate limits, quotas por plano)
type: feature
---

# Controlo Enterprise de Custos IA

## Camadas de proteção
1. **Membership + Plano** — `consume_ai_credit(shop_id, function_name, cost, metadata)` valida user pertence à oficina.
2. **Rate Limit** — janelas de 60s: por utilizador (default 10/min) e por oficina (default 30/min) via `ai_rate_limits`.
3. **Orçamento Global** — soma `cost_estimate_eur` do mês vs `ai_monthly_budget_eur * ai_safety_margin_pct/100`. Default 250€ com margem 95%.
4. **Quota por Plano** — `plan_limits_catalog` chave `ai_credits_month`; -1 = ilimitado, 0 = plano sem IA.
5. **Cache** — `ai_response_cache` por `prompt_hash + function_name`. Hit → 0 crédito.

## RPCs
- `consume_ai_credit(_shop_id, _function_name, _cost, _metadata)` — valida cadeia completa para uso por oficina.
- `consume_platform_ai_credit(_function_name, _cost, _metadata)` — só super_admin, sem shop_id, valida orçamento global.
- `ai_try_cache(_prompt_hash, _function_name)` / `ai_save_cache(...)` — gestão de cache.
- `get_ai_admin_stats()` — devolve `budget_eur, month_spend_eur, month_pct, top_shops, top_functions, by_plan, blocked_globally`.
- `get_ai_usage(_shop_id)` — quota atual para hook `useAiQuota`.

## Guard partilhado
`supabase/functions/_shared/ai-guard.ts` — `guardAiCall({ shopId, functionName, cost, promptHash, metadata })`:
- Valida cache, consume_ai_credit, devolve `{ cached, response, saveToCache }`.
- Serve resposta cached com header `X-AI-Cached: true`.

## Edge Functions protegidas
- **User-facing** (guard shop-level): `ai-diagnosis`, `marketing-ai-insights`.
- **Admin-only** (guard platform-level via `consume_platform_ai_credit`): `ai-business-forecast`, `marketing-autopilot`, `marketing-creative`, `seo-generate-article`.

## Painel Super Admin
`/admin/ai-control` — mostra orçamento, chamadas, cache, top funções/oficinas, editor de settings (budget, margem, rate limits, custo/crédito).

## Settings em `platform_settings`
- `ai_monthly_budget_eur` (default 250)
- `ai_safety_margin_pct` (default 95)
- `ai_cost_per_credit_eur` (default 0.02)
- `ai_rate_per_min_user` (default 10)
- `ai_rate_per_min_shop` (default 30)

## Regra fundamental
Backend é única fonte de verdade. Frontend só reflete estado; nunca decide se pode chamar IA.
