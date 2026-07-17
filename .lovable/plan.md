
## Objetivo

Blindar completamente o consumo de IA do GarageFlow **sem tocar** em Design, Layout, UX, Stripe, Billing, Marketplace, Multi-Oficina, Landing Page, Dashboard, SEO, RLS, RBAC, APIs existentes ou qualquer módulo do ERP fora da camada IA. Só é adicionada infraestrutura de controlo de custos por cima da que já existe (`ai_usage_ledger`, `consume_ai_credit`, `useAiQuota`).

## Regra base preservada

1 pedido = 1 crédito. Continua assim. Nada de tokens.

---

## 1. Base de dados (uma migração)

**Extensões a `ai_usage_ledger`**
- `cost_estimate_eur numeric(10,4)` — custo estimado por chamada.
- `prompt_hash text` — para deduplicação/cache.
- `cached boolean default false` — marca chamadas servidas por cache.

**Nova tabela `ai_response_cache`**
- `cache_key text primary key` (hash de `shop_id + function + prompt_hash`).
- `response jsonb`, `expires_at timestamptz`.
- GRANTs corretos, RLS: só server-side (service_role).

**Nova tabela `ai_rate_limits`** (in-memory-like, com TTL curto)
- `subject_type` (`user`|`shop`), `subject_id uuid`, `window_start timestamptz`, `count int`.
- Índice único `(subject_type, subject_id, window_start)`.

**`platform_settings` — novas chaves** (não altera schema):
- `ai_monthly_budget_eur` — orçamento máximo mensal (default 250).
- `ai_safety_margin_pct` — margem de segurança (default 95).
- `ai_rate_per_min_user` (default 10).
- `ai_rate_per_min_shop` (default 30).
- `ai_cache_ttl_seconds` (default 900 = 15 min).
- `ai_cost_per_credit_eur` (default 0.02 — configurável).

**RPC `consume_ai_credit` (reescrita, mesmo contrato)** — passa a validar em ordem:
1. Membro da oficina? (bloqueia se não)
2. Plano tem IA? (`plan_no_ai` se limite = 0)
3. Rate limit user + shop? (`rate_limited`)
4. Orçamento global mensal < margem de segurança? (`global_budget_exceeded`)
5. Quota mensal da oficina? (`quota_exceeded`)
6. Regista consumo com `cost_estimate_eur`.

**Novas RPCs**
- `ai_try_cache(_cache_key)` → devolve `response` se válido, senão null.
- `ai_save_cache(_cache_key, _response, _ttl_seconds)`.
- `get_ai_admin_stats(_from, _to)` → agregações para o painel (chamadas hoje/mês, top oficinas, top utilizadores, top funções, por plano, por país, por dia, orçamento consumido). Super admin only.

---

## 2. Guard centralizado (Edge Functions)

Novo módulo `supabase/functions/_shared/ai-guard.ts` com uma função `guardAiCall({ req, shopId, functionName, prompt })` que:

1. Autentica o utilizador via JWT.
2. Calcula `prompt_hash = sha256(prompt normalizado)`.
3. Tenta `ai_try_cache` — se hit, devolve resposta imediata (0 créditos, marca `cached=true` no ledger com custo 0).
4. Chama `consume_ai_credit`. Se recusar, devolve HTTP 402/403/429 conforme reason.
5. Devolve helpers: `saveCache(response)` e `estimateCost()`.

**Edge functions IA existentes passam pelo guard** (sem alterar a lógica de negócio, só o wrapper de entrada):
- `ai-diagnosis` ✓ (já parcialmente feito, migra para guard)
- `marketing-ai-insights` ✓ (idem)
- `ai-business-forecast`
- `marketing-creative`
- `marketing-autopilot`
- `seo-generate-article`
- `market-translate-listing`
- `market-kyc-auto-verify`

Se alguma delas contém consultas puramente SQL (previsões baseadas em dados históricos), passa a servir esses casos **sem chamar o modelo** (regra nº 1: se o DB responde, não gasta IA).

---

## 3. Frontend

**Sem mudanças de design/layout.** Apenas:

- `useAiQuota` já existe. Estende-se para incluir estado global (`globalBudgetPct`, `globalBlocked`).
- Componentes `AIDiagnosisPanel` e `MarketingAIAssistant` já mostram badge — passam a mostrar também aviso quando `globalBlocked` (orçamento da plataforma atingido).

**Nova página Super Admin**: `src/pages/admin/AdminAIControl.tsx`
- Cartões de estatística (dados reais via `get_ai_admin_stats`).
- Configuração inline de `ai_monthly_budget_eur`, `ai_safety_margin_pct`, rate limits, TTL de cache, custo por crédito.
- Ranking de oficinas/utilizadores/funções.
- Consumo por plano/país/dia.
- Design usa os tokens e componentes já existentes (`Card`, `Badge`, `Progress`).

Adicionada entrada de menu no Admin apenas — sem mexer no menu do ERP.

---

## 4. Comportamento efetivo

```text
Pedido IA
  → Guard verifica JWT + membership
  → Cache? sim → devolve (0 €)
  → Rate limit user/shop? passa
  → Global budget × margem 95% já atingido? bloqueia (global_budget_exceeded)
  → Plano tem IA? passa
  → Quota mensal da oficina? passa
  → Chama modelo → guarda no ledger (custo est.) → guarda em cache
```

Bloqueios automáticos independentes:
- Global (Super Admin) — protege o negócio.
- Por plano (limite mensal configurável).
- Rate limit por utilizador e por oficina.

---

## 5. Detalhes técnicos

- Hash de prompt: `encode(digest(lower(trim(prompt)), 'sha256'), 'hex')` (pgcrypto já disponível).
- Rate limit: janela de 60 segundos, contagem incrementada dentro de `consume_ai_credit`, sem tabela em RAM (mantém-se simples e auditável).
- Cache TTL: default 15 minutos, configurável. Chave por (shop, função, prompt) — não vaza entre oficinas.
- Custo estimado: `ai_cost_per_credit_eur` × créditos consumidos. Ficamos independentes de tokens.
- Segurança: nenhuma nova policy afeta tabelas existentes; `ai_response_cache` fica sem policies para roles não-server (só service_role acede).

---

## 6. Fora de âmbito (não tocamos)

Stripe, Billing, Landing, Marketplace UI, Multi-Oficina, Dashboard, Clientes, Veículos, Inventário, APIs REST, RLS/RBAC das restantes tabelas, SEO — tudo intocado. Zero migrações fora da camada IA. Zero alterações à Sidebar do ERP.

---

## 7. Relatório final (a apresentar após implementação)

Onde a IA foi adicionada, como é controlado o consumo, como é impedido o abuso, limites por plano, orçamento global com margem de 95 %, bloqueio automático, cache, rate limit, e confirmação explícita de que não é possível ultrapassar o orçamento definido pelo Super Admin.

---

**Estimativa**: 1 migração + 1 módulo guard + 8 edge functions atualizadas (só o wrapper) + 1 nova página admin + 2 componentes com aviso extra.

Confirmas para eu avançar?
