# Auditoria e Sistema Unificado de Planos, Features e Gating

Este é um trabalho de grande dimensão. Vou executá-lo em **6 fases sequenciais**, cada uma validada antes de avançar, para evitar regressões num projeto desta complexidade (já tem centenas de páginas, edge functions, Stripe multi-país, Market, afiliados, etc.).

Regras: não remover funcionalidades, não mexer em auth, não quebrar Stripe de clientes existentes, não alterar layouts sem necessidade. Tudo retrocompatível.

---

## Fase 1 — Auditoria (READ-ONLY, sem alterações)

Antes de qualquer código, gerar relatório em `docs/AUDIT_PLANS.md` cobrindo:

1. **Inventário completo** — varrer `src/pages`, `src/App.tsx`, `src/components/Layout.tsx`, `MarketLayout.tsx`, `supabase/functions/*`, `useSubscription.ts`, `PlanGate.tsx`, `platformSettings.ts`.
2. Listar: todas as rotas, todos os itens de menu, todas as edge functions, todos os hardcodes de preço (`49`, `69`, `99`, `129`, `19`, `39`), todas as tabelas em `supabase_realtime`, todos os pontos onde se lê `subscription.plan`.
3. Mapear estado atual vs. estado-alvo (matriz feature × plano).
4. Listar discrepâncias (ex.: features acessíveis por URL sem gate, menus hardcoded, preços fixos na landing/afiliados).

**Entregável Fase 1:** apenas o documento de auditoria. O utilizador revê antes de avançar.

---

## Fase 2 — Esquema único de verdade (DB)

Migração SQL única com:

- `features` (slug, name, description, category, active) — catálogo de TODAS as funcionalidades descobertas na Fase 1.
- `plan_features` (plan_slug, feature_slug, enabled, limits jsonb) — matriz editável.
- Seed inicial respeitando o que **já existe hoje** (sem cortar acesso a ninguém).
- View `v_plan_feature_matrix` para o admin consumir.
- RPC `user_can_use_feature(_user_id, _shop_id, _feature_slug) returns boolean` — SECURITY DEFINER, usada por frontend e edge functions.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE` para `features`, `plan_features` (e auditar/adicionar as que faltarem da lista do utilizador: appointments, quotes, work_orders, invoices, stock_movements, alerts, notifications, chat_messages, market_*).
- GRANTs + RLS (leitura pública das duas tabelas de features, escrita só super_admin).

**Não toca** em `subscriptions`, `shops`, `country_settings`, `plan_price_history` — esses mantêm-se.

---

## Fase 3 — Camada frontend unificada

- `src/lib/features.ts` — hook `useFeature(slug)` + `useFeatures()` com cache (react-query), invalidação por realtime.
- `src/components/FeatureGate.tsx` — wrapper que mostra upgrade card quando `!enabled` (reutiliza estética do `PlanGate` existente para não mudar UX).
- `src/components/Layout.tsx` / `MarketLayout.tsx` — **menu gerado dinamicamente** a partir de `useFeatures()`, mantendo a ordem e ícones atuais. Itens sem permissão somem.
- `src/App.tsx` — wrapper `<RouteFeatureGuard feature="...">` em cada rota gateable. Acesso direto por URL → mostra upgrade, não 404.
- Migrar `PlanGate` existente para delegar internamente a `useFeature` (compat total — nenhum call-site precisa mudar imediatamente).

---

## Fase 4 — Proteção backend

- Helper `_shared/canUseFeature.ts` para edge functions (chama o RPC).
- Aplicar em edge functions sensíveis identificadas na Fase 1 (ex.: `create-checkout` para market, `market-*`, geração de relatórios, API pública v1).
- Endpoints existentes continuam a funcionar; apenas adicionam validação extra.

---

## Fase 5 — Stripe e preços 100% dinâmicos

- Auditar e **remover todos os hardcodes** (`49/69/99/129/19/39`) de:
  - `src/pages/Billing.tsx`
  - landing (`src/pages/Index.tsx` e similares)
  - página de afiliados / partner
  - qualquer componente de pricing
- Tudo lê de `country_settings` (já existe — memory `Stripe Multi-Country`) via hook único `usePlanPricing(country)`.
- Checkout (`create-checkout` edge function) — confirmar que já lê do DB; se ainda tiver fallback hardcoded, remover.
- Afiliados: `commission = plan.current_price * commission_rate` (lido do DB).
- **Clientes existentes mantêm subscription Stripe antiga intacta** — não tocamos em `stripe_subscription_id` já criados.

---

## Fase 6 — Painel Admin (matriz visual)

- `src/pages/admin/AdminFeatureMatrix.tsx` — tabela Feature × Plano com toggles.
- Cada toggle faz `UPDATE plan_features` → realtime propaga → todos os clientes atualizam menu/rotas sem deploy.
- Integrar como tab dentro de `AdminSettings.tsx` (não criar página solta).
- Pricing continua em `country_settings` (já existe).

---

## Validação final

Checklist executado e reportado:
- [ ] Build sem erros
- [ ] Toda feature listada está na matriz
- [ ] Menu dinâmico funciona (testado com plano free/pro/garage)
- [ ] Acesso por URL bloqueado quando feature off
- [ ] `rg "69|129|49|99" src/` sem matches de preço
- [ ] Realtime ativo em todas as tabelas críticas
- [ ] Market continua a abrir corretamente (regra de memory respeitada)
- [ ] Nenhuma regressão em auth/onboarding

---

## Confirmação necessária antes de começar

Esta é uma refatoração estrutural enorme (estimo 30-50 ficheiros tocados, 1 migração grande, várias horas de trabalho/créditos). Antes de avançar, **confirma**:

1. **Posso fazer a refatoração faseada** (Fase 1 entrega só auditoria, paras, revês, e dás luz verde para Fase 2)? Ou queres tudo de uma vez?
2. **Política para clientes existentes em planos pagos**: mantenho o acesso atual deles a TUDO o que já tinham, mesmo que a nova matriz por defeito desligue alguma feature? (recomendado: sim, via grandfathering)
3. **Há alguma feature que NUNCA pode ser desativável** (ex.: dashboard, clientes, veículos — core)? Vou marcar essas como `is_core=true` não-editáveis.

Responde a estas 3 perguntas e arranco pela Fase 1 (auditoria) imediatamente.
