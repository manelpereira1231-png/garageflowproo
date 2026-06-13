# Runbooks Operacionais — GarageFlow

Manual de resposta a incidentes para suporte L1/L2. Atualizar sempre que surgir uma classe nova de incidente.

---

## 1. Escrow preso (Market)

**Sintoma:** Vendedor diz que vendeu o carro mas dinheiro não chegou.
**Diagnóstico:**
1. `/admin/market-escrows` → procurar por `listing_id` ou email.
2. Verificar `status`: `pending_inspection`, `funds_held`, `released`, `disputed`.
3. Confirmar `inspection_report` existe e `passed=true`.
4. Verificar `payout` em Stripe Connect (botão "Sync" no detalhe).

**Resolução típica:**
- Falta inspeção → notificar oficina; usar `Forçar release` apenas se houver evidência externa.
- Stripe payout failed → reabrir KYC do vendedor em `/admin/market-kyc`.

---

## 2. Pagamento Stripe pendente / subscrição não ativa

**Sintoma:** Cliente pagou mas plano continua FREE.
**Diagnóstico:**
1. `/admin/billing` → procurar shop.
2. Ver `subscriptions.status` e `stripe_webhook_events` (últimos 50).
3. Edge function logs: `stripe-webhook`.

**Resolução:**
- Webhook não entregue: re-emit em Stripe Dashboard.
- Subscription manual: usar `Sincronizar com Stripe` no detalhe da shop.

---

## 3. Action Queue acumulada

**Sintoma:** Alerta `system_alert:action_queue` ou `/admin/action-queue` mostra >50 failed/h.
**Diagnóstico:**
1. Abrir `/admin/action-queue` e clicar `Executar worker`.
2. Ver `failed_jobs` e ler `last_error` das top entradas.
3. Confirmar que `action_whitelist` contém o `action_type`.

**Resolução:**
- Erro transitório → `retry_failed_jobs` (botão Manutenção).
- Erro persistente → corrigir a função alvo, depois retry.

---

## 4. Reclamação com SLA ultrapassado

**Sintoma:** `/admin/complaints` mostra badge `SLA BREACH`.
**Resolução:** ACK em <15min, atualizar para `in_progress`, comunicar com cliente, resolver com nota.

---

## 5. Taxa de erro 5xx alta

**Sintoma:** Alerta `system_alert:api_5xx`.
**Diagnóstico:**
1. `supabase--analytics_query` para `function_edge_logs` com `status_code >= 500`.
2. Identificar função recorrente.
3. Ver Edge logs da função.

**Resolução:** rollback se introduzido em deploy recente; hotfix + redeploy.

---

## 6. Suspeita de fuga RLS

**Sintoma:** Cliente reporta ver dados de outra oficina.
**Resposta imediata:**
1. Bloquear utilizador suspeito (`/admin/users` → suspender).
2. Confirmar com `supabase--linter`.
3. Auditar políticas da tabela suspeita.
4. Notificar afetados em <72h (RGPD art. 33).
5. Registar em `audit_logs` com `event_type='security_incident'`.

---

## 7. Recuperação de desastre

Ver `docs/DR_PLAN.md`.
