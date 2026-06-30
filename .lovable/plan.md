
# Painel Admin SaaS + Stripe + Feature Gating real

Pedido tem âmbito enorme e toca em sistemas já em produção (Stripe BYOK, `subscriptions`, `country_settings.stripe_*`, `plan_features`, `features`, `useSubscription`, `FeatureGate`, edge function `admin-update-plan-price`, `admin-sync-stripe`, webhooks). Antes de mexer, importa não destruir o que já funciona (pagamentos atuais, clientes existentes, RLS).

Proponho 4 lotes incrementais. Cada lote é entregue, testado e validado por ti antes do próximo.

---

## Lote 1 — Admin: CRUD real de planos (persistência + Stripe sync)

**Objetivo:** poderes editar nome, preço, ciclo, descrição e estado de cada plano no painel, com persistência real e sync automático com Stripe.

- Nova tabela `plans` (slug `free|pro|garage`, name, description, active, sort_order). Já existem `country_settings.saas_*` para preços por país — mantém-se como fonte de preço por país.
- Página `/admin/plans` com:
  - Editor por plano (nome, descrição, ativo).
  - Editor de preço por país × ciclo (lê/grava `country_settings`).
  - Botão "Sincronizar com Stripe" que invoca a edge function existente `admin-update-plan-price` (já cria novo `Price`, desativa o antigo, regista em `plan_price_history`).
- Realtime em `plans` + `country_settings` para refletir em toda a app (landing + billing).
- Plano "free" passa a editável: se preço > 0, comporta-se como pago (checkout Stripe normal).

**Garantias:** zero hardcode de preço, histórico preservado, subscrições antigas mantêm o Price antigo (Stripe não permite editar Price — já estás a criar novo).

---

## Lote 2 — Feature gating real (backend = fonte de verdade)

**Objetivo:** quando desativas "Faturas" no plano Free no admin, um utilizador Free perde acesso real (sidebar + URL + API).

- Já existe `plan_features` e RPC `user_can_use_feature` (vejo `supabase/functions/_shared/canUseFeature.ts`).
- Auditar todas as edge functions sensíveis (invoices, quotes, services, clients, vehicles) e adicionar `ensureFeature(req, "<slug>")` no topo.
- Garantir que `useFeature()` e `FeatureGate` lêem o mesmo `plan_features` (já fazem).
- Página `/admin/features` (já existe) — verificar que escreve em `plan_features` em vez de só em memória.
- Realtime já está ligado em `src/lib/features.ts` (`features-matrix` channel).

**Resultado:** uma alteração no admin propaga em < 1s sem refresh, e o backend rejeita pedidos não autorizados.

---

## Lote 3 — Webhooks Stripe (acesso automático)

**Objetivo:** quando alguém paga / cancela / falha pagamento no Stripe, o acesso muda automaticamente sem clicar em "sincronizar".

- Nova edge function pública `stripe-webhook` (verify_jwt=false) com verificação de assinatura (`STRIPE_WEBHOOK_SECRET`).
- Eventos tratados:
  - `checkout.session.completed` → upsert `subscriptions` (plan, status=active).
  - `customer.subscription.updated` → atualiza plano/ciclo/status.
  - `customer.subscription.deleted` → status=canceled, plan=free.
  - `invoice.payment_failed` → status=past_due.
- Tabela `stripe_webhook_events` já existe — usar para idempotência.
- Mantém `admin-sync-stripe` como fallback manual.

**Pré-requisito:** preciso que adiciones o secret `STRIPE_WEBHOOK_SECRET` (vou pedir via `add_secret`) e configures o endpoint no Stripe Dashboard depois.

---

## Lote 4 — Separação Clientes vs Veículos

**Importante:** já estão separados na BD (`clients` e `vehicles` são tabelas distintas, FK `vehicles.client_id → clients.id`). O que provavelmente vês é UI a misturar (ex: lista de veículos a mostrar dados do cliente no mesmo card).

Antes de mexer preciso que me digas **exatamente onde vês a mistura** (página, screenshot ou descrição):
- `/clients` mostra veículos misturados?
- `/vehicles` mostra clientes como se fossem o mesmo registo?
- Form de criação une os dois?

Sem isto arrisco refatorar algo que está bem. Lote 4 fica em espera até confirmares.

---

## Riscos / não vou fazer

- **Não vou** recriar a integração Stripe (já existe BYOK + `admin-update-plan-price`). Vou reutilizar.
- **Não vou** apagar `subscriptions` existentes nem mexer em Prices antigos no Stripe.
- **Não vou** mudar slugs de plano (`free|pro|garage`) — quebraria toda a matriz.
- **Não vou** tocar em `src/integrations/supabase/client.ts`, `types.ts`, `supabase/config.toml` (auto-gerados).

---

## Como avançar

Confirma:
1. **Começo pelo Lote 1** (admin CRUD + sync Stripe)? Sim/Não.
2. **Lote 3 (webhooks):** tens acesso ao Stripe Dashboard para configurar o endpoint e gerar o `STRIPE_WEBHOOK_SECRET`?
3. **Lote 4:** onde exatamente vês clientes e veículos misturados? (página + descrição curta)

Assim que confirmares, arranco o Lote 1.
