
# Auditoria Enterprise ao Painel de Administração

## 1. Inventário atual (41 páginas de admin)

Agrupadas por assunto real, para expor sobreposições:

**Dashboards / visões gerais (6 páginas — 4 sobrepostas)**
- `AdminDashboard` (Centro de Controlo)
- `AdminBusinessMetrics` (métricas de negócio)
- `AdminSystemHealth` (saúde sistema)
- `AdminSystemControl` (funcionalidades + avisos + kill switches)
- `AdminMarketDashboard` (dashboard marketplace)
- `AdminCarity` (inspeções — herdou nome legacy)

**Planos / preços / funcionalidades (4 páginas — dispersas)**
- `AdminPlans` — nome, estado, ordem, limites, CTAs, IA
- `AdminFeatureMatrix` — matriz de features por plano
- `AdminCountries` — preços Stripe por país
- `AdminAIControl` — limites de IA por plano/global

**Billing / Finance / Reports / Accounting (5 páginas — 3 sobrepostas)**
- `AdminBilling` (planos + subscrições listagem)
- `AdminFinance` (receita/MRR)
- `AdminReports` (relatórios gerais, KPIs)
- `AdminAccounting` (contabilidade)
- `AdminBusinessMetrics` (também mostra MRR/ARR)

**Marketplace (7 páginas)**
- `AdminMarketDashboard`, `AdminMarketListings`, `AdminCarity` (inspeções), `AdminMarketEscrows`, `AdminMarketKYC`, `AdminMarketActivations`, `AdminRiskEngine`

**Marketing / Growth (6 páginas — 4 sobrepostas)**
- `AdminMarketing`, `AdminMarketingAutopilot`, `AdminGrowth`, `AdminGrowthOpportunities`, `AdminTraffic`, `AdminFeatureAdoption`, `AdminSeo`, `AdminSeoBlog`, `AdminCoupons`

**Utilizadores / Suporte (5 páginas — parcialmente sobrepostas)**
- `AdminUsers`, `AdminShops`, `AdminShopDetail`, `AdminDemoRequests`, `AdminSupport`, `AdminComplaints`, `AdminActionQueue`, `AdminPartners`

**Sistema (7 páginas — dispersas)**
- `AdminSettings`, `AdminSystemControl`, `AdminSystemHealth`, `AdminLogs`, `AdminAlerts`, `AdminEmailLogs`, `AdminRateLimits`

## 2. Duplicações confirmadas (evidência)

| # | Duplicação | Onde | Deve viver em |
|---|---|---|---|
| D1 | **Estado/nome do plano** editável | `AdminPlans` **e** `AdminBilling` (edição inline de subscrições altera plano) | `AdminPlans` (fonte única) |
| D2 | **Preço do plano** | `AdminPlans` (default) **e** `AdminCountries` (por país) — ambos gravam | `AdminCountries` (por país é a verdade) + `AdminPlans` lê |
| D3 | **Features por plano** | `AdminPlans` (limits + `has_features`) **e** `AdminFeatureMatrix` | `AdminFeatureMatrix` (fonte única) |
| D4 | **Limites (utilizadores, oficinas, IA)** | `AdminPlans.limits_json` **e** `AdminAIControl` (limites IA) | `AdminPlans.limits_json` — `AdminAIControl` só orçamento global |
| D5 | **Trial (dias)** | `AdminPlans` **e** `AdminSystemControl` (platform_settings) | `AdminPlans` |
| D6 | **Kill switches / feature flags** | `AdminSystemControl` **e** `AdminSettings` | `AdminSystemControl` |
| D7 | **MRR/ARR/receita** exibida | `AdminFinance`, `AdminReports`, `AdminBusinessMetrics`, `AdminDashboard` | `AdminFinance` (canónico) + Dashboard só mostra widget |
| D8 | **Marketing** | `AdminMarketing` + `AdminMarketingAutopilot` + `AdminGrowth` + `AdminGrowthOpportunities` | Unificar rota `/admin/marketing` com tabs |
| D9 | **Tráfego/adoção** | `AdminTraffic` + `AdminFeatureAdoption` | Sub-tabs de `AdminMarketing` (Aquisição/Adoção) |
| D10 | **Marketplace overview** | `AdminMarketDashboard` **e** `AdminCarity` (mistura inspeções + overview) | Split: dashboard vs inspeções |
| D11 | **Comissões marketplace** | `country_settings.market_commission_rate` **e** `carity_listings.commission_rate` (por anúncio) | `country_settings` (defaults) + listing só override justificado |
| D12 | **Alertas / notificações admin** | `AdminAlerts` + `AdminEmailLogs` + `AdminComplaints` + `AdminActionQueue` | Unificar `AdminActionQueue` como inbox operacional |
| D13 | **Utilizadores vs Oficinas** | `AdminUsers` e `AdminShops` cruzam dados de utilizadores/donos | Manter separadas mas com link canónico shop→users |

## 3. Hardcodes detetados (`if (plan === 'free'|'pro'|'garage')`)

Ocorrências em produção:
- `src/lib/features.ts` (linhas 98, 189, 218, 231) — fallback legacy
- `src/lib/platformSettings.ts` (145–171) — mapeia gates a nomes fixos
- `src/pages/Dashboard.tsx` (79, 362, 670, 715)
- `src/pages/Quotes.tsx`, `src/pages/QuoteForm.tsx`
- `src/pages/Settings.tsx` (217)
- `src/lib/pdfGenerator.ts` (65), `src/lib/invoicePdfGenerator.ts` (76)
- `src/pages/MarketDealerDashboard.tsx` (112)
- `src/pages/admin/AdminReports.tsx` (129–179)
- `src/pages/admin/AdminDashboard.tsx` (88)

Estes são o núcleo do problema "editar plano no admin não reflete em todo o lado" — cada um destes ficheiros ignora o catálogo dinâmico.

## 4. Configurações mortas / redundantes

- `AdminSettings` sobrepõe-se totalmente a `AdminSystemControl` — candidato a arquivar.
- `AdminGrowth` e `AdminGrowthOpportunities` — duas páginas com o mesmo objetivo.
- `AdminMarketingAutopilot` — sub-área de Marketing.
- `AdminAlerts` — hoje é apenas um feed que já existe em `AdminActionQueue`.

## 5. Nova arquitetura proposta (menus)

7 grupos, cada opção existe uma única vez:

```
Plataforma
  Centro de Controlo        /admin
  Saúde do Sistema          /admin/system-health
  Kill Switches & Flags     /admin/system              (ex-SystemControl)
  Idiomas & Moedas          /admin/settings?tab=locale (canónico aqui)
  Auditoria                 /admin/logs
  Emails                    /admin/emails
  Rate Limits               /admin/rate-limits

Planos
  Planos                    /admin/plans               (fonte única: nome/estado/ordem/trial/limits/IA)
  Funcionalidades           /admin/features            (fonte única de features)
  Preços por País           /admin/countries           (fonte única de preços)
  Cupões & Promoções        /admin/coupons
  IA (Custos & Orçamento)   /admin/ai-control          (só orçamento global — limites por plano vivem em Planos)

Clientes
  Oficinas                  /admin/shops
  Utilizadores              /admin/users
  Subscrições & Faturas     /admin/billing             (só leitura de estado Stripe — não edita planos)
  Receita                   /admin/finance             (canónico MRR/ARR)
  Contabilidade             /admin/accounting
  Relatórios                /admin/reports             (compostos, lê de finance)

Marketplace
  Marketplace (Overview)    /admin/market-dashboard
  Anúncios                  /admin/market-listings
  Inspeções                 /admin/market
  Escrow & Disputas         /admin/market-escrows
  KYC                       /admin/market-kyc
  Adesões                   /admin/market-activations
  Risk Engine               /admin/risk-engine
  Comissões                 (sub-tab em Países — não duplicar)

Marketing
  Campanhas                 /admin/marketing?tab=campaigns
  Autopiloto                /admin/marketing?tab=autopilot   (ex-MarketingAutopilot)
  Oportunidades             /admin/marketing?tab=growth      (ex-Growth + GrowthOpportunities)
  Aquisição (Tráfego)       /admin/marketing?tab=traffic     (ex-Traffic)
  Adoção                    /admin/marketing?tab=adoption    (ex-FeatureAdoption)
  SEO                       /admin/seo
  Blog                      /admin/seo-blog

Suporte
  Action Queue (Inbox)      /admin/action-queue        (agrega alertas + reclamações)
  Reclamações               /admin/complaints
  Suporte                   /admin/support
  Demonstrações             /admin/demos
  Parceiros                 /admin/partners

Operações
  Veículos (Global)         /admin/vehicles
```

Páginas fundidas em tabs, **sem eliminar código** — ficheiros existentes montam-se como tabs da mesma rota, garantindo zero regressões. `AdminSettings` e `AdminAlerts` continuam acessíveis por URL para links antigos, mas saem do menu.

## 6. Refactor de fonte única — o que muda no backend

Zero alterações a schema, RLS, Stripe, Edge Functions ou RBAC.

Alterações apenas em `src/lib/features.ts`, `platformSettings.ts` e páginas com `plan === 'x'` para lerem sempre do catálogo (`usePlansCatalog`, `plan_limits_catalog`, `plan_country_prices`). Cada consumidor passa a resolver via helpers já existentes (`hasFeature`, `getLimit`, `getPlanPrice`).

## 7. Plano de execução seguro (por lotes)

**Lote 1 — Reorganização do menu** (`src/components/AdminLayout.tsx`)
- Reescrever `navSections` com os 7 grupos acima.
- Manter todas as rotas existentes (sem apagar páginas).
- Zero risco funcional.

**Lote 2 — Fusão em tabs** (Marketing e Sistema)
- `AdminMarketing.tsx` passa a expor tabs internas que fazem `lazy import` de `AdminMarketingAutopilot`, `AdminGrowth`, `AdminGrowthOpportunities`, `AdminTraffic`, `AdminFeatureAdoption`.
- `AdminSystemControl.tsx` absorve os toggles de `AdminSettings` (mantendo `/admin/settings` como redirect para a tab correta).

**Lote 3 — Remover duplicação de edição**
- `AdminBilling`: remover controlos que editam o plano; passar a mostrar só o estado Stripe e link "Editar plano em /admin/plans".
- `AdminAIControl`: remover campos de limite por plano; passar a ler `plan_limits_catalog` e editar apenas orçamento global.

**Lote 4 — Erradicar hardcodes**
- Substituir `plan === 'free'|'pro'|'garage'` por leitura de features/limites no catálogo, ficheiro a ficheiro (lista da secção 3).

**Lote 5 — Relatório final** com diff de duplicações eliminadas, hardcodes removidos e mapa de propagação (create/edit plan → landing/checkout/billing/erp).

## 8. Aprovação necessária

Preciso de confirmar antes de tocar em código:

1. Confirmas os **7 grupos de menu** e as fusões em tabs propostas (secção 5)?
2. Confirmas que `AdminSettings` e `AdminAlerts` saem do menu (mas rotas continuam vivas para não partir bookmarks)?
3. Executo os **5 lotes em sequência** com commit por lote, ou preferes ver só o Lote 1 primeiro para validar?
4. Alguma página desta lista que **não pode** ser tocada nesta ronda?

Assim que confirmares, arranco pelo Lote 1 (só sidebar, zero risco) e sigo até ao 5.
