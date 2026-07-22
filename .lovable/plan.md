## Auditoria — o que JÁ existe (preservar tal e qual)

| Área | Estado |
|---|---|
| `index.html` — title/description/keywords, canonical `https://garageflow.pt/`, hreflang para 10 locales, OG + Twitter, JSON-LD Organization + WebSite (com SearchAction) + WebSite Market + SoftwareApplication com Offers multi-moeda e AggregateRating | ✅ completo |
| `public/robots.txt` — regras dedicadas para Googlebot, Bingbot, Slurp, DuckDuckBot, Baidu, Yandex, Applebot + social (Twitter, Facebook, LinkedIn, WhatsApp, Telegram) + AI bots (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot); bloqueia `/admin/`, `/dashboard`, `/settings`, `/billing`, `/portal/`, `/quote/`, `/book/`, áreas privadas do Market | ✅ completo |
| Sitemaps — `sitemap.xml` (index) + `sitemap-erp.xml` (362 linhas, hreflang xhtml) + `sitemap-market.xml` (176 linhas, marcas/modelos/segmentos/combustíveis/cidades) | ✅ existe |
| Componente `SEOHead` reutilizado em 15+ páginas (Landing, ERP, Market, Carity*, SeoLandingPage, Support, Status, DemoRequest, LegalPage…) | ✅ padrão consistente |
| Páginas informativas — Privacy, Terms, Cookie, DPA, MarketTerms, MyData, Support, Status | ✅ existem |
| Verificação Google (`googlebe17105fda2d860d.html`), `og-image.jpg`, `og-market.jpg`, `humans.txt`, `llms.txt`, `sw.js` | ✅ presentes |
| Manifest PWA (`manifest.json`) | ⚠️ existe mas só referencia `favicon.ico` como ícone |

## O que NÃO vou fazer (violaria as tuas regras)

- ❌ Não crio Blog, Glossário, Guias, Docs, Sobre, Contacto, Funcionalidades novos — o site já tem `SeoLandingPage`, `CarityBy*` (make, model, city, price, segment, fuel), `ErpLanding`, `GratisLanding`, `OficinasPiloto`, `MarketStandsDirectory`. Criar mais categorias sem estratégia editorial = thin content e canibalização.
- ❌ Não migro para SSR — o stack é Vite SPA; o hosting Lovable serve o `index.html` estático com meta completa (Googlebot renderiza JS). Uma migração SSR é um refactor destrutivo.
- ❌ Não substituo os sitemaps estáticos por gerador dinâmico sem confirmação — as regras de sitemap knowledge exigem-no e há 538 linhas cuidadosamente curadas com hreflang que se perderiam.
- ❌ Não toco em `robots.txt` (já bloqueia tudo o que deve).
- ❌ Não altero JSON-LD, canonical nem hreflang do `index.html` (estão corretos).

## O que VOU implementar (ganhos reais, zero regressão)

### 1. Impedir indexação dos domínios de preview (crítico, pedido explícito)
Adicionar no `index.html`, dentro do bloco `<script>` de bootstrap, um pequeno guard que:
- Se `location.hostname` for `*.lovable.app` (preview / staging) OU qualquer host ≠ `garageflow.pt`, injeta `<meta name="robots" content="noindex,nofollow">` **antes** do Googlebot ler.
- Substitui `link[rel=canonical]` e `og:url` para apontar para o equivalente em `https://garageflow.pt`.
- Não afeta o domínio de produção (a condição só dispara fora dele).

Isto garante que apenas `garageflow.pt` é indexável, sem alterar rotas nem UX.

### 2. Manifest PWA — ícones em falta
- Gerar `icon-192.png` e `icon-512.png` (maskable) a partir do logo/brand existente.
- Adicionar `apple-touch-icon.png` (180×180) — o atual aponta para `og-image.jpg` (1200×630, formato errado).
- Atualizar `manifest.json` com os ícones novos (mantendo o `favicon.ico` como fallback).
- Adicionar `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` no `index.html` (substituindo a linha atual).

### 3. `browserconfig.xml` (Windows/Edge tiles) — pedido explícito
Ficheiro trivial em `public/`, referencia o ícone 192 e a `theme_color` já usada.

### 4. Sitemaps — refrescar `lastmod`
Atualizar os `<lastmod>` dos 3 sitemaps para a data atual (estão em Junho/Abril, sinal de estagnação para o Google). Sem tocar em URLs nem estrutura.

### 5. Validação pós-mudanças
- Confirmar build sem erros.
- Verificar com `curl` que `robots.txt`, `sitemap.xml`, `sitemap-erp.xml`, `sitemap-market.xml`, `manifest.json`, `browserconfig.xml` respondem 200.
- Confirmar que o guard de noindex só dispara em hosts `lovable.app`.

## Fora do meu alcance (intervenção manual tua)

- **Cadeia de redirects HTTPS/WWW** — controlado pela DNS/hosting Lovable, não por código. Já verificarei o comportamento via `curl` e reporto.
- **Ligar `garageflow.pt` no Google Search Console e submeter os sitemaps** — requer login teu.
- **Lighthouse 100/100/100/100** — objetivo aspiracional; o projeto tem centenas de dependências. Posso auditar métricas específicas se pedires uma página concreta.
- **Semrush / rank tracking / backlink outreach** — trabalho de crescimento, não de código.

## Ordem de execução

1. Guard noindex + canonical rewrite em `index.html`.
2. Gerar ícones PNG (192, 512, apple-touch-icon).
3. Atualizar `manifest.json` + `<link>` do apple-touch-icon.
4. Criar `browserconfig.xml`.
5. Refrescar `lastmod` dos 3 sitemaps.
6. Verificar tudo com `curl` e reportar.

Confirma este plano (ou diz o que queres tirar/adicionar) e avanço.
