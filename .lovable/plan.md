# Arquitetura de Planos 100% Dinâmica — Plano de Execução

## Ponto de partida (já feito nos ciclos anteriores)

- `plans`, `features`, `plan_features`, `plan_promotions`, `plan_country_prices`, `plan_price_history` — **schema dinâmico** ✅
- Landing, Billing, PriceWithPromo — **lêem da BD com realtime** ✅
- Edge functions (`create-checkout`, `admin-update-plan-price`, `admin-set-promotion`) — **resolvem preços via RPC** ✅
- RPC `get_effective_plan_price` + hook `usePlanPricing` — ✅
- Painel `AdminPlans` — CRUD dinâmico ✅
- Kill switch `market_enabled` — validado ✅
- Modo Grupo Garage (Dashboard) — ✅

## O que ainda está acoplado a `free|pro|garage` (auditoria)

**Tipos/gating (crítico):**
1. `src/hooks/useSubscription.ts` — `type Plan = 'free'|'pro'|'garage'`, `PLAN_LIMITS` hardcoded como fallback, `LOCKED_LIMITS`.
2. `src/lib/features.ts` — `useCurrentPlan()` restringe retorno, `GARAGE_ONLY_FEATURES` fixo.
3. `src/components/PlanGate.tsx` + `FeatureGate.tsx` — prop `requiredPlan: 'pro'|'garage'`.
4. `src/App.tsx` — ~25 rotas com `requiredPlan="pro"` ou `"garage"`.
5. `src/lib/planPromotions.ts` — `PlanSlug = 'free'|'pro'|'garage'`.
6. `src/lib/platformSettings.ts` — `planFeatureKeysFor`, `limitOverridesFor` com ramos por slug.

**UI que ramifica por slug:**
7. `Dashboard.tsx` (5 checks), `Quotes.tsx` (4 checks), `PartnersPortal.tsx` (comissão 20% se garage).
8. `AdminBilling.tsx` (downgrade → `'free'`), `AdminDashboard.tsx` (contadores/receita por slug).

**PDFs:**
9. `pdfGenerator.ts` / `invoicePdfGenerator.ts` — watermark se `plan === 'free'`.

**SEO/Landing JSON-LD:** já dinâmico ✅ (filtra por `visible_on_landing`).

## Estratégia — 4 fases, retrocompatível, zero UI change

### Fase A — Fundação de tipos + leitura de limites (baixo risco)

- Alargar `Plan` para `string` mantendo alias `'free' | 'pro' | 'garage'` como valores conhecidos.
- Novo helper `resolvePlanLimits(planSlug)` em `useSubscription`:
  1. Tenta `plan_features` (BD) → agrega `limits` jsonb + `enabled` de cada feature.
  2. Fallback para `PLAN_LIMITS` hardcoded apenas para os 3 slugs legacy.
  3. Para planos novos sem entrada em `plan_features`: deriva limites do plano de `order_index` inferior (defensivo).
- Novo helper derivado: `isEntryPlan` (plano com menor `order_index` ativo) — substitui checks `=== 'free'`.
- `LOCKED_LIMITS` → derivado de `isEntryPlan` do plano ativo.

### Fase B — Gating por feature (não por slug)

- `PlanGate` / `FeatureGate` passam a aceitar `requiredFeature: string` (slug de feature). Prop antiga `requiredPlan` mantida com deprecation shim: converte `'pro'` → primeira feature Pro-only, `'garage'` → primeira Garage-only, via lookup em `plan_features`.
- Rotas em `App.tsx` migram progressivamente para `requiredFeature="reports_advanced"` etc. **Sem alterar UI/mensagem** — o modal de upgrade continua a mostrar "necessita Plano X" onde X = plano mínimo que habilita a feature (calculado dinamicamente).

### Fase C — Remover ramos hardcoded na UI

- `Dashboard.tsx`, `Quotes.tsx`, `PartnersPortal.tsx`: `plan === 'free'` → `!limits.<feature>` ou `isEntryPlan`. Comissão do PartnersPortal passa a ler `plans.partner_commission_pct` (nova coluna nullable com fallback 10%/20%).
- `pdfGenerator.ts`: watermark passa a olhar `limits.pdfWatermark` (já existe em `platformSettings`).
- `AdminBilling.tsx` downgrade: escolhe plano com menor `order_index` ativo (não `'free'`).
- `AdminDashboard.tsx`: breakdown por slug torna-se `for (plan of plans) { count[plan.slug] = ... }`.

### Fase D — Limpar tipos legacy

- `planPromotions.ts`: `PlanSlug = string`.
- `platformSettings.ts`: `planFeatureKeysFor`/`limitOverridesFor` recebem plano como objeto e lêem features da BD (mantendo defaults para os 3 slugs enquanto BD estiver vazia).

## Retrocompatibilidade garantida

- Nenhuma coluna removida. Nenhum enum apagado. Fallbacks para os 3 slugs mantidos em todo o lado.
- Clientes atuais (assinaturas Stripe ativas em `free`/`pro`/`garage`) continuam a resolver limites exatamente como hoje.
- Nenhuma migração destrutiva. Apenas leitura adicional de `plan_features`.

## Fora de escopo (respeitando a instrução "não alterar")

- Design, layout, textos, cores, componentes visuais.
- Fluxo Stripe existente (produtos/prices/webhooks).
- RLS, RBAC, Marketplace, SEO estrutural.
- Market plans (`dealer_plan`: `starter|pro|unlimited`) — sistema separado, não faz parte deste refactor.

## Escopo desta iteração

**Fases A + B** (fundação + gating por feature) — 6 ficheiros editados, zero UI change, zero regressão esperada.
**Fases C + D** ficam para iteração seguinte após validação em produção.

## Validação (será executada)

1. Build TypeScript passa.
2. Utilizador `free` atual continua bloqueado exatamente nas mesmas rotas.
3. Utilizador `garage` atual continua com acesso total.
4. Criar plano fictício `enterprise` na BD com `plan_features` habilitando tudo → utilizador com esse plano passa por todas as rotas sem tocar em código.
5. Painel `AdminPlans` continua a criar/editar/arquivar sem erros.

## Relatório final entregue no fim

- Lista exata de hardcodes removidos (ficheiro:linha).
- Lista de fallbacks mantidos e porquê.
- Prova (screenshots/queries) de que plano novo funciona end-to-end.
- Confirmação de zero regressões nos 3 slugs existentes.

---

**Confirmas que avanço com Fases A + B nesta iteração?** (Fase C+D fica para o próximo ciclo, para manter cada passo pequeno e verificável — respeita a tua regra "sem asneiras".)
