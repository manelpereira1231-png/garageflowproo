# SEO Portugal + Growth Engine — Plano de Implementação

Tudo aditivo. Nada existente é alterado ou removido.

## 1. Expansão de páginas SEO (PT-PT)

Adicionar ao `src/lib/seoPagesPT.ts` novas entradas (sem remover as atuais):

**Intenção alta:**
- `/melhor-software-oficinas-portugal`
- `/software-oficinas-preco`
- `/software-oficinas-cloud`
- `/erp-oficina-automovel`

**Problema:**
- `/como-gerir-oficina`
- `/como-fazer-orcamentos-oficina`
- `/como-controlar-clientes-oficina`
- `/como-organizar-oficina-automovel`
- `/como-gerir-viaturas-oficina`

**Comparativas:**
- `/software-oficinas-vs-excel`
- `/erp-vs-excel-oficina`

Cada uma com H1 único, FAQ próprio, CTA "Testar grátis 30 dias", links internos, JSON-LD FAQPage + SoftwareApplication + Breadcrumb.

## 2. SEO programático local (sem duplicar conteúdo)

Adicionar rotas dinâmicas:
- `/gestao-oficinas/:cidade`
- `/erp-automovel/:cidade`
- `/software-oficinas/:cidade`

Reutilizar `SeoCityPage.tsx` com variação por "intent" (gestão / erp / software) que altera H1, intro e FAQ — garantindo conteúdo parcialmente único por combinação.

Adicionar LocalBusiness JSON-LD nas páginas locais.

## 3. Blog SEO (estrutura)

Criar `src/lib/seoBlogPT.ts` com 6 artigos iniciais (categorias: Gestão, Faturação, Clientes, Viaturas, Produtividade, ERP):
- como-organizar-uma-oficina-automovel
- como-reduzir-erros-em-orcamentos
- oficina-ainda-usa-excel
- como-controlar-revisoes-automovel
- como-aumentar-produtividade-oficina
- como-gerir-clientes-recorrentes

Rotas: `/blog`, `/blog/:slug`. Componente `SeoBlogPost.tsx` + `SeoBlogIndex.tsx` com Article JSON-LD, Breadcrumb, links internos para landings de conversão.

## 4. Schema markup global

Adicionar ao `index.html` JSON-LD `Organization` + `SoftwareApplication` sitewide. Páginas locais ganham `LocalBusiness`. Páginas SEO ganham `BreadcrumbList`.

## 5. Sitemap atualizado

Atualizar `public/sitemap-erp.xml` com todas as novas URLs (intenção alta, problema, comparativas, programáticas por cidade × 3 intents, blog).

## 6. Tracking SEO real + deteção de tráfego interno

**Migração DB** (aditiva):
- Adicionar colunas a `landing_visits`: `is_internal boolean`, `internal_reason text`, `confidence text`, `scroll_depth int`, `time_on_page int`, `first_touch_source text`.
- Nova tabela `seo_conversions` (landing_visit_id, user_id, shop_id, converted_at, page_path, source).

**Frontend** (`src/lib/landingTracker.ts` — expandir, não substituir):
- Detetar interno: localhost, `lovable.app` no hostname, `?internal=true`, cookie `gf_internal`, super_admin role, emails @lovable.dev.
- Classificar: `real` / `likely_internal` / `suspicious` / `bot` (via UA).
- Gravar scroll depth e tempo na página via `beforeunload`.
- Guardar first_touch em `localStorage` (`gf_first_touch`).

## 7. Admin SEO Portugal (nova página)

Nova rota admin `/admin/seo` → `src/pages/admin/AdminSeo.tsx`:
- KPIs: visitas orgânicas reais (exclui interno), conversões SEO, taxa de conversão, top páginas, top cidades, desktop/mobile, Google vs Bing vs outros.
- Tabela first-touch / last-touch.
- Tabela de visitas excluídas com motivo + confiança.
- Sincronização automática (já existe padrão `useAdminStripeAutoSync` — replicar com `useAdminSeoAutoRefresh`).
- Botão "Exportar CSV".

Adicionar item "SEO Portugal" no `AdminLayout.tsx` na secção CRESCIMENTO.

## 8. Restrições respeitadas

- Não toca em ERP, Market, pagamentos, afiliados, Stripe sync, tracking de ads existente.
- `gadsTracking.ts` e `landingTracker.ts` continuam a funcionar; apenas se adicionam campos.
- Nenhum SEO existente é substituído; tudo é adicionado.
- Tudo PT-PT, sem mock data, sem métricas inventadas.

## Ficheiros

**Criar:**
- `src/lib/seoBlogPT.ts`
- `src/pages/seo/SeoBlogIndex.tsx`
- `src/pages/seo/SeoBlogPost.tsx`
- `src/pages/admin/AdminSeo.tsx`
- `src/hooks/useAdminSeoAutoRefresh.ts`
- `src/lib/internalTrafficDetect.ts`
- Migração SQL (colunas + tabela conversions + RLS)

**Editar (aditivamente):**
- `src/lib/seoPagesPT.ts` (novas entradas)
- `src/pages/seo/SeoCityPage.tsx` (suportar intent variante)
- `src/App.tsx` (novas rotas)
- `src/components/AdminLayout.tsx` (link SEO Portugal)
- `src/lib/landingTracker.ts` (expandir payload + interno + scroll)
- `index.html` (JSON-LD sitewide)
- `public/sitemap-erp.xml` (novas URLs)
