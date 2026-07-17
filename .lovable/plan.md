# Planos & Features 100% dinâmicos — plano de execução faseado

## Estado atual (auditoria)

Já existe muita da arquitetura pedida — **não vou reconstruir, apenas generalizar**:

- `plans` (slug, name, description, category, active) — já dinâmica.
- `features` (slug, name, description, category, active) — já dinâmica.
- `plan_features` (plan_slug, feature_slug, enabled, limits jsonb) — já dinâmica, os limites já vivem em jsonb.
- `plan_promotions` (country_code, plan, cycle, promo_price, stripe_price_id, starts_at, ends_at, active) — já dinâmica.
- `plan_price_history` — auditoria já dinâmica.
- Edge functions `admin-set-promotion`, `admin-update-plan-price`, `create-checkout` — leem preços da BD em runtime.
- Landing, Billing, PriceWithPromo — já leem tudo da BD com realtime.
- RLS + `is_super_admin` — só Super Admin escreve; oficinas só leem.

## Único ponto de acoplamento a nomes fixos

`country_settings` tem colunas **hardcoded por slug**:
`saas_free_monthly/yearly`, `saas_pro_monthly/yearly`, `saas_garage_monthly/yearly`,
`stripe_free_*`, `stripe_pro_*`, `stripe_garage_*`, `stripe_*_product_id`.

Isto significa que criar um plano novo (`business`, `enterprise`) hoje exige código.
**É este o único bloqueio real** — o resto da arquitetura já é dinâmica.

## Estratégia (retrocompatível, sem regressões)

Substituir as colunas fixas de `country_settings` por uma **nova tabela `plan_country_prices`** que armazena preços/Stripe IDs por `(plan_slug, country_code, cycle)` — e manter as colunas antigas como **views/gerados** durante uma janela de migração para código legacy que ainda as leia.

Nada muda visualmente. Nada muda no Stripe. Toda a lógica atual de checkout/billing passa a resolver preços via `plan_country_prices` em vez de colunas fixas — API idêntica.

---

## Fase 1 — Schema dinâmico (migração 1)

Nova tabela `plan_country_prices`:
```
plan_slug text (FK → plans.slug, cascade)
country_code text (FK → country_settings.code)
cycle text CHECK (monthly | yearly | quarterly | semestral | lifetime)
currency text
amount numeric NOT NULL
stripe_product_id text
stripe_price_id text
active bool default true
UNIQUE (plan_slug, country_code, cycle)
```
+ GRANT + RLS (SELECT público, ALL só super admin) + trigger updated_at.

Backfill: copiar `saas_free_*/pro_*/garage_*` e `stripe_*` de `country_settings` para linhas de `plan_country_prices`. Uma única migração idempotente.

Extensão a `plans`:
- `color text`, `icon text`, `order_index int`, `label text` (etiqueta tipo "Mais Popular"), `visible_on_landing bool`, `visible_on_billing bool`, `visible_on_checkout bool`, `visible_on_compare bool`, `archived_at timestamptz`.

Extensão a `features`:
- `icon text`, `order_index int` (categoria já existe).

Extensão a `plan_features` (limits já é jsonb — sem alterações estruturais; documentar as chaves suportadas: `max_shops`, `max_users`, `max_clients`, `max_vehicles`, `max_work_orders`, `max_listings`, `max_uploads`, `storage_mb`, `api_calls`, `emails_per_month`, `sms_per_month`, `pdfs_per_month`, `backups`).

Nada é apagado. Colunas antigas de `country_settings` **ficam em `country_settings`** com um trigger que espelha alterações para `plan_country_prices` — retrocompatibilidade total durante todo o processo.

## Fase 2 — Camada de leitura unificada

Novo RPC `get_effective_plan_price(plan_slug, country_code, cycle)` → devolve `{base_amount, effective_amount, stripe_price_id, promo_active, promo_ends_at, currency}`. Junta `plan_country_prices` + `plan_promotions` numa única chamada — já existe `get_active_promotion`, alarga-o.

Front-end: `usePlanPricing()` hook novo que centraliza fetches (Landing, Billing, PriceWithPromo, UpgradeModal) — substitui as leituras diretas a `country_settings.saas_*_*` sem alterar UI.

Edge functions `create-checkout` e `admin-update-plan-price`: passam a resolver via RPC. Comportamento externo idêntico.

## Fase 3 — Painel Admin unificado

Nova página `/admin/plans-manager` (ou expandir a atual `AdminPlans`) — mesma estética shadcn:
- Lista de planos: criar, duplicar, arquivar, restaurar, reordenar, ativar/desativar, ocultar por superfície.
- Editor de plano: nome, slug (imutável após criação para preservar Stripe), descrições, cor, ícone, etiqueta, ordem, visibilidade.
- Grelha de preços por país × ciclo (usa `plan_country_prices`).
- Grelha de features × plano (usa `plan_features`, edita `enabled` + `limits` jsonb com editor tipado por chave).
- Grelha de limites (mesma tabela `plan_features` com `feature_slug='limits'` ou coluna `limits` a nível do plano — a decidir na Fase 3).
- Botão "Criar Stripe Product & Prices" chama edge function existente `admin-update-plan-price` já preparada para criar produtos.
- Delete só permitido se `subscriptions` não referenciar o plano; senão sugere "Arquivar".

Gestor de features:
- CRUD completo. Delete só se não estiver em `plan_features` ativo.

## Fase 4 — Landing / Billing / Checkout / SEO

Sem alterações visuais. `LandingPage.tsx` já itera sobre `plans` da BD; passa a filtrar por `visible_on_landing` e a ordenar por `order_index`. Etiquetas ("Mais Popular") passam a vir de `plans.label`. JSON-LD `SoftwareApplication` Offers passa a ser gerado por loop sobre planos visíveis + preços efetivos + `priceValidUntil` quando há promoção — ficheiro `LandingPage.tsx` já tem o esqueleto, só troca de fonte.

## Fase 5 — Limpeza deferida (opcional, fora deste ciclo)

Só depois de confirmar em produção que nada lê as colunas antigas:
- Marcar `country_settings.saas_*_*` / `stripe_*_*` como deprecated.
- Manter triggers de espelho por 1-2 ciclos e só então remover.

Nunca vou remover colunas neste ciclo — retrocompatibilidade é regra.

---

## Escopo desta iteração

Isto é trabalho para **múltiplas iterações**. Proponho começar por **Fase 1 + Fase 2** nesta ronda (fundação retrocompatível, zero UI alterada, zero regressões) e passar Painel Admin (Fase 3) para a próxima. Assim garantimos que:

1. Criar um plano novo na BD passa a alimentar Landing/Billing/Checkout automaticamente.
2. UI de administração vem por cima da fundação já testada.

## Confirmações necessárias antes de escrever migração

1. Confirmas **Fase 1 + Fase 2 primeiro** (schema + RPC + hook), Fase 3 (UI Admin) depois?
2. `plan_country_prices.cycle`: confirmo suporte a `monthly | yearly | quarterly | semestral | lifetime` desde já, ok?
3. O slug do plano deve ser **imutável após criação** (para não invalidar Stripe subscriptions existentes). Ok?
4. Delete de plano/feature com clientes ativos → **bloqueado**, sugere Arquivar. Ok?
