# Plano de execução — GarageFlow

Este é um trabalho grande. Vou dividi-lo em 4 blocos sequenciais. Cada bloco é entregue e validado antes do próximo, para não introduzir regressões em autenticação, oficinas ou permissões.

---

## Bloco 1 — Correção rápida (alto impacto, baixo risco)

1. **Rota Marketplace no Dashboard**
   - Auditar `src/components/Layout.tsx`, `App.tsx`, `NavLink.tsx`, `PlanGate.tsx`.
   - Garantir que o item "Market" navega para `/market` (ou rota correcta do Carity Marketplace) e não cai no fallback `/dashboard`.
   - Confirmar que `PlanGate` não redireciona Market para Dashboard.

2. **Templates WhatsApp / mensagens profissionais**
   - Substituir os textos em `src/lib/messageTemplates.ts` (PT) pelas 4 versões fornecidas: Ordem concluída, Orçamento aprovado, Orçamento pendente, Viatura pronta.
   - Manter as variáveis `{{client_name}}`, `{{shop_name}}`, `{{quote_number}}`, etc. já existentes para não quebrar o renderer.
   - Atualizar também os templates email seed em `seed_email_templates_for_shop` se aplicável (sem alterar schema).

3. **Comissões de afiliados dinâmicas**
   - Auditar `src/pages/AffiliateDashboard.tsx`, `PartnersPortal.tsx`, `supabase/functions/partner-automation/*`.
   - Remover qualquer valor fixo (49/69/99/129). Calcular sempre `commission = plan_price_actual × commission_percentage`, lendo o preço de `country_settings` (mesma fonte que o checkout já usa).

---

## Bloco 2 — Single Source of Truth para preços (frontend)

Hoje os preços já vivem em `country_settings` e são lidos via `useCountryPricing` + `getRegionalPricing`. O checkout já usa `country_settings.stripe_*_*` com fallback EUR. O que falta:

1. **Auditoria de hardcodes**
   - `rg -n "\\b(49|69|99|129)\\b" src/ supabase/functions/` para listar e eliminar.
   - Substituir todos os locais por `useCountryPricing()` (UI) ou leitura de `country_settings` (edge functions).
   - Alvos prováveis: `LandingPage.tsx`, `GratisLanding.tsx`, `Billing.tsx`, `OficinasPiloto.tsx`, qualquer banner de upgrade.

2. **Realtime já está activo** (migração anterior adicionou `country_settings` à publicação). Confirmar que `LandingPage` e `Billing` re-renderizam ao receber `garageflow:pricing-updated`.

3. **Fallback EUR no `create-checkout`** — manter para resiliência, mas registar warning quando usado (sinal de configuração em falta).

---

## Bloco 3 — Stripe auto-provisioning (Admin → Stripe)

Hoje o admin guarda o preço em `country_settings` mas o `stripe_*_price_id` tem de ser colado à mão. Vou automatizar:

1. **Nova edge function `admin-update-plan-price`**
   - Input: `{ country_code, plan: 'pro'|'garage', cycle: 'monthly'|'yearly', amount_cents, currency }`.
   - Resolve/cria `stripe_product_id` por país+plano (guarda em `country_settings.stripe_pro_product_id` / `stripe_garage_product_id` — novas colunas).
   - Cria **novo** `Stripe Price` (nunca actualiza o antigo → clientes actuais mantêm preço).
   - Marca o antigo Price como `active: false` no Stripe.
   - Faz `UPDATE country_settings SET stripe_{plan}_{cycle} = <novo_id>, {plan}_price_{cycle} = <novo_valor>`.
   - Restrito a `is_super_admin(auth.uid())`.

2. **Histórico de preços**
   - Nova tabela `plan_price_history (id, country_code, plan, cycle, old_price_id, new_price_id, old_amount, new_amount, changed_by, changed_at)`.
   - RLS: leitura só para super_admin, INSERT pela edge function via service_role.
   - GRANTs explícitos.

3. **AdminCountries / AdminSettings UI**
   - Substituir os campos de "Stripe Price ID" pelos campos de preço (€) + botão "Aplicar". Botão chama a edge function. O Price ID deixa de ser editável manualmente (apenas visível como read-only para debug).

---

## Bloco 4 — Validação final

1. Procurar de novo por hardcodes (`rg`) e por imports de regions estáticos.
2. Testar fluxo: alterar preço Pro no admin → ver landing/billing actualizarem em <2s → criar checkout → confirmar novo Price ID no Stripe.
3. Testar clique em Market a partir do Dashboard → abre `/market`.
4. Confirmar comissão de afiliado calculada com novo preço.
5. Relatório final (resumo dos ficheiros tocados, hardcodes removidos, novas funções).

---

## Detalhes técnicos

```text
country_settings  ──► useCountryPricing (cache + realtime) ──► LandingPage/Billing/Affiliate
       │
       └─► create-checkout (lê stripe_*_*) ──► Stripe Checkout
       ▲
       │
admin-update-plan-price (nova) ──► Stripe API (cria Price novo) ──► UPDATE country_settings
                                                                       │
                                                                       └─► plan_price_history
```

Nova tabela `plan_price_history` segue o template padrão (GRANTs + RLS + service_role).
Nenhum schema existente é destruído. Nenhum Price antigo é apagado (compatibilidade clientes actuais).

---

## Confirmação antes de executar

Este plano é grande (~4 blocos, ~15 ficheiros, 1 migração, 1 nova edge function). Sugiro avançar **Bloco 1 já** (correções rápidas e templates) e depois confirmas se queres seguir para Blocos 2-4 na mesma sessão, ou se preferes faseado.

Confirma que posso avançar com **Bloco 1** primeiro?
