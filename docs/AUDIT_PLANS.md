# GarageFlow — Auditoria de Planos, Features e Gating (Fase 1)

Data: 2026-06-21
Âmbito: leitura. **Zero alterações** ao código ou DB nesta fase.

---

## 1. Inventário de rotas (src/App.tsx)

### ERP (autenticadas, dentro de `<Layout>`)
| Rota | Página | Gate atual |
|------|--------|------------|
| /dashboard | Dashboard | — |
| /clients | Clients | — |
| /vehicles | Vehicles | — |
| /quotes, /quotes/new, /quotes/edit/:id | Quotes / QuoteForm | — |
| /services, /services/new, /services/edit/:id | Services / ServiceForm | — |
| /settings, /settings/email-templates | Settings, EmailTemplates | — |
| /billing | Billing | — |
| /alerts | Alerts | `PlanGate basicAlerts pro` |
| /team | Team | `PlanGate teamManagement pro` |
| /chat | Chat | `PlanGate chatbot garage` |
| /invoices, /invoices/new, /invoices/:id | Invoices | — |
| /financial/reports | FinancialReports | `PlanGate basicReports pro` |
| /agenda | Agenda | — |
| /catalog | ServiceCatalog | — |
| /stock | Stock | **sem gate** ⚠ |
| /inspections | Inspections | **sem gate** ⚠ |
| /loyalty | Loyalty | `PlanGate loyalty garage` |
| /marketing | Marketing | `PlanGate marketing garage` |
| /workshop | Workshop | — |
| /automations | Automations | `PlanGate automations garage` |
| /developers | Developers (API) | `PlanGate api garage` |
| /partners | PartnersPortal | — |
| /referrals | Referrals | — |
| /warranties | Warranties | — |
| /support | Support | — |

### Market (oficina e público)
/market, /market/auth, /market/sell, /market/pay/:id, /market/car/:id, /market/listing/:id, /market/carros/:slug, /market/make/:make, /market/city/:city, /market/modelo/:m/:mo, /market/preco/:r, /market/combustivel/:f, /market/segmento/:s, /market/dashboard, /market/dealer-dashboard, /market/dealer/bulk, /market/my-listings, /market/messages, /market/profile, /market/favoritos, /market/purchases, /market/inspections, /market/wallet, /market/payouts

### Admin (39 rotas) e públicas (/, /afiliados, /quote/:token, /portal/:token, /book/:slug, /status, etc.)

---

## 2. Menu lateral (src/components/Layout.tsx)

Hoje é **array hardcoded** com `locked: !canUseFeature(...)` por item. Itens lockados continuam a aparecer com badge. **Não é gerado dinamicamente a partir do DB.**

Grupos: Operação Diária, Faturação, Comunicação, Crescimento, Market, Administração, Inventário.

---

## 3. Fonte atual de verdade (features)

`src/lib/platformSettings.ts` mantém arrays `freeFeatures / proFeatures / garageFeatures` lidos da tabela `platform_settings` (KV). O hook `useSubscription.canUseFeature()` consulta esses arrays.

Features já reconhecidas pelo sistema:
`quotes, work_orders, clients, invoices, service_catalog, alerts_basic, alerts_advanced, team, agenda, reports_basic, reports_advanced, csv_export, quote_approval, client_portal, stock, inspections, chat, marketing, loyalty, multi_shop, api, automations`

### ⚠ Discrepâncias detectadas
- Rotas **sem gate** que correspondem a features pagas: `/stock`, `/inspections`, `/catalog`, `/workshop`, `/agenda` (todas livres atualmente).
- Menu Market (`/market/inspections`, `/market/wallet`) **não tem feature flag** (controlado por `is_carity_partner`).
- Item "API" tem `feature="api"` mas string usada em `canUseFeature` é `api` — só em `garageFeatures`. ✔
- Não existe feature flag para: `dashboard`, `vehicles`, `services`, `billing`, `support`, `referrals`, `warranties`, `partners` — sempre acessíveis.

---

## 4. Edge functions (60)

Sensíveis a gating: `create-checkout, dealer-checkout, market-escrow-*, garageflow-api, export-saft, ai-business-forecast, ai-diagnosis, marketing-*, seo-*, partner-*, send-lifecycle-email, smart-reminders, system-*`.

Nenhuma delas chama hoje um RPC do tipo `user_can_use_feature`. Validação atual depende apenas de RLS + cliente.

---

## 5. Hardcodes de preço

Pesquisa `49|69|99|129` em `src/`:
- **Billing / Landing / Affiliates: limpos** ✅ (preços lidos de `country_settings`).
- `src/i18n/legalContent.ts` linhas 26, 54, 82, ~110 — Termos & Condições mencionam "Pro 49€/mês, Garage 99€/mês" em PT, BR e EN. **Texto legal, mas desatualizado** (deveria ler 69/129 ou ser dinâmico).
- `src/lib/regionConfig.ts:67` — preços de inspeção do Market (89,90 / 50,00 / 39,90). Não é preço de plano, mas também devia migrar para `country_settings`.
- `src/lib/platformSettings.ts:51,168` — `garageUserLimit: 999` (sentinel para "ilimitado", OK).

**Conclusão:** os preços de subscrição já são dinâmicos no checkout. Resta corrigir o **texto legal** e migrar **preços de inspeção** do Market.

---

## 6. Realtime (publicação `supabase_realtime`)

Tabelas atualmente publicadas (21):
alerts, appointments, carity_chat_messages, carity_inspection_offers, carity_inspections, carity_listings, carity_offers, chat_messages, country_settings, invoice_items, invoices, market_escrow, notifications, parts_order_items, parts_orders, quotes, sale_confirmations, shops, stock_movements, subscriptions, work_orders.

### Comparação com lista pedida pelo utilizador
| Pedida | Publicada |
|--------|-----------|
| appointments | ✅ |
| quotes | ✅ |
| work_orders | ✅ |
| invoices | ✅ |
| stock_movements | ✅ |
| alerts | ✅ |
| notifications | ✅ |
| chat_messages | ✅ |
| marketplace (carity_listings/offers/escrow) | ✅ |

**Tudo OK.** Faltariam adicionar `platform_settings` e (após Fase 2) `features` + `plan_features` para o menu/rotas se invalidarem em tempo real.

---

## 7. Estado-alvo (matriz Feature × Plano) — proposta

Catálogo proposto (slug → categoria):

| slug | categoria | Free | Pro | Garage | Notas |
|------|-----------|------|-----|--------|-------|
| dashboard | core | ✅ | ✅ | ✅ | is_core |
| clients | core | ✅ | ✅ | ✅ | is_core |
| vehicles | core | ✅ | ✅ | ✅ | is_core |
| quotes | core | ✅ (10/mês) | ✅ | ✅ | quota |
| services / work_orders | core | ✅ | ✅ | ✅ | |
| workshop_mode | ops | ✅ | ✅ | ✅ | |
| agenda | ops | ❌ | ✅ | ✅ | hoje livre — **mudança** |
| inspections | ops | ❌ | ✅ | ✅ | hoje livre — **mudança** |
| service_catalog | ops | ✅ | ✅ | ✅ | |
| stock / inventory | ops | ❌ | ✅ | ✅ | hoje livre — **mudança** |
| warranties | ops | ❌ | ✅ | ✅ | |
| invoices | finance | ✅ | ✅ | ✅ | |
| financial_reports_basic | finance | ❌ | ✅ | ✅ | |
| financial_reports_advanced | finance | ❌ | ❌ | ✅ | |
| csv_export | finance | ❌ | ✅ | ✅ | |
| alerts_basic | comms | ❌ | ✅ | ✅ | |
| alerts_advanced | comms | ❌ | ❌ | ✅ | |
| chat / chatbot | comms | ❌ | ❌ | ✅ | |
| client_portal | comms | ❌ | ✅ | ✅ | |
| quote_approval | comms | ✅ | ✅ | ✅ | |
| public_booking | comms | ❌ | ✅ | ✅ | |
| marketing | growth | ❌ | ❌ | ✅ | |
| automations | growth | ❌ | ❌ | ✅ | |
| loyalty | growth | ❌ | ❌ | ✅ | |
| referrals | growth | ✅ | ✅ | ✅ | |
| team_management | admin | ❌ | ✅ (5) | ✅ | |
| multi_shop | admin | ❌ | ❌ | ✅ (5) | |
| api | admin | ❌ | ❌ | ✅ | |
| settings | admin | ✅ | ✅ | ✅ | is_core |
| market_workshop_panel | market | depende `is_carity_partner` | | | gate ortogonal |

**Mudanças de comportamento** (3): agenda, inspections, stock passam a precisar de Pro. Isto **pode quebrar utilizadores Free existentes**. Resposta da Q2 abaixo decide.

---

## 8. Plano para Fases 2-6 (sem mudanças até confirmação)

Inalterado em relação ao `.lovable/plan.md` aprovado.

---

## 9. Riscos identificados

1. **Quebra para clientes Free existentes** se ativarmos os 3 gates novos (agenda/inspections/stock) sem grandfathering.
2. **Textos legais desatualizados** (49/99 nos Termos) — corrigir mesmo se manter abordagem.
3. **Edge functions hoje sem validação de feature** — adicionar é trivial mas precisa de testes.
4. **Cache do menu** — sem invalidação realtime, mudança no admin só refletia ao próximo F5; Fase 3 resolve via subscribe a `plan_features`.

---

## 10. Decisões necessárias antes da Fase 2

(Mesmas 3 perguntas do plano — agora com contexto.)

1. **Execução faseada (Fase 1 → revisão → Fase 2)** ou **tudo de uma vez**?
2. **Grandfathering**: clientes Free atuais mantêm acesso a agenda/inspections/stock? (recomendado: **sim**, marcar com flag `legacy_free_access`).
3. **Features `is_core` não-editáveis**: dashboard, clients, vehicles, quotes, services, invoices, settings. Confirmar?

Responde a estas 3 e arranco Fase 2 (migração DB + RPC).
