# Auditoria SEO — Diagnóstico e Plano

## Resumo (Fase 0 — causa raiz confirmada)

O projeto é **React + Vite + react-router, 100% client-side (SPA pura)**. Não existe SSR, SSG nem pré-renderização (`vite.config.ts` só tem `react-swc` + `lovable-tagger`; `public/_redirects` tem `/* /index.html 200`).

Teste real com `curl -A "Googlebot"` em produção:

```text
/alternativa-excel-oficinas               -> 13049 bytes
/como-gerir-oficina                       -> 13049 bytes
/blog/como-aumentar-produtividade-oficina -> 13049 bytes
```

As três devolvem **exatamente o mesmo HTML** (mesmo byte count), com:
- `<title>GarageFlow | Software Gestão Oficinas Automóvel e Mecânicos</title>` (título genérico da app, igual em todas)
- mesma meta description genérica
- **sem `<h1>`, sem canonical, sem JSON-LD, sem conteúdo**
- `<div id="root"></div>` vazio

Ou seja: o Google descobre ~290 URLs pelo sitemap, faz fetch, recebe uma casca idêntica sem conteúdo único e decide não gastar crawl budget → **"Descoberta, atualmente não indexada"**. Esta é a causa nº1. Tudo o resto é secundário.

## Fase 1 — Outros problemas encontrados

1. **Páginas órfãs**: `grep` na landing page e componentes globais não encontra **um único link interno** para `/blog`, `/alternativa-excel-oficinas`, `/como-gerir-oficina` ou para as páginas de cidade. As ~290 URLs existem só no sitemap → sinal de importância quase nulo.
2. **hreflang inválido**: `SEOHead.tsx` emite 10 `hreflang` diferentes a apontar **todos para o mesmo URL**, mais `x-default` igual. Google ignora ou trata como conflito.
3. **Título/descrição duplicados no HTML servido**: só divergem depois do JS (Helmet), portanto para o crawler inicial são todos iguais.
4. **Sitemap estático e desatualizado**: `lastmod` fixo em `2026-07-22` em todos os 299 + 131 URLs, escrito à mão. Não é gerado no build, logo diverge das rotas reais.
5. **Structured data incompleto**: landings têm só `FAQPage`; blog não tem `Article`; não há `BreadcrumbList` nem `SoftwareApplication` nas páginas SEO.
6. **Conteúdo programático semelhante**: 83 landings + ~60 páginas de cidade partilham o mesmo template; as de cidade são as mais fracas (thin content).
7. **robots.txt**: correto — não bloqueia nenhuma das páginas afetadas. Sem `X-Robots-Tag: noindex` nas respostas (verificado nos headers).

## Fase 2 — Alterações propostas (só SEO técnico)

| Ficheiro | Alteração | Porquê |
| --- | --- | --- |
| `plugins/seo-prerender.ts` (novo) | Plugin Vite que, no fim do build, gera um `index.html` estático por rota SEO com `<title>`, description, canonical, JSON-LD e o **conteúdo real em HTML** (h1, intro, secções, FAQ, links internos) lido de `src/lib/seoPagesPT.ts` e `src/lib/seoBlogPT.ts` | Googlebot passa a receber conteúdo único sem executar JS |
| `vite.config.ts` | Registar o plugin | Ativar SSG no build de produção |
| `scripts`/plugin | Gerar `sitemap-erp.xml` a partir das mesmas fontes de dados, com `lastmod` real | Sitemap deixa de divergir das rotas |
| `src/components/SEOHead.tsx` | hreflang self-referencing correto (remover 10 alternates para o mesmo URL, manter `x-default` + locale próprio) | Elimina conflito de hreflang |
| `src/components/LandingLayout.tsx` (footer) | Bloco de links internos reais (`<a href>`/`<Link>`) para blog, guias e páginas-pilar | Elimina orfandade — sinal de crawl |
| `src/pages/seo/SeoLandingPage.tsx` | Secção "Artigos e guias relacionados" com links internos + JSON-LD `BreadcrumbList` e `SoftwareApplication` | Interligação e rich results |
| `src/pages/seo/SeoBlogPost.tsx` | JSON-LD `Article` + `BreadcrumbList` + links para landings relacionadas | Elegibilidade a rich results |
| `src/pages/seo/SeoCityPage.tsx` | `BreadcrumbList` + links para páginas-pilar | Reforço de contexto |

Não vou apagar páginas. As páginas de cidade com conteúdo fino ficam assinaladas como candidatas a consolidação no relatório final, para tua decisão.

## Fora do âmbito (não mexo)

Design, UX, lógica de negócio, rotas da app privada, i18n de conteúdo, plano de conteúdo editorial.

## Notas técnicas

O prerender corre em `closeBundle`: os módulos de conteúdo (`seoPagesPT.ts`, `seoBlogPT.ts`) são puramente dados, portanto são compilados com esbuild para um bundle temporário e importados em Node — sem dependências de browser. O HTML gerado é substituído pelo React na hidratação, pelo que não há alteração visual para o utilizador.

## Fase 4 — Verificação

`curl -A "Googlebot"` a 5 páginas (incluindo os 4 exemplos) sobre o build de produção local, confirmando `<title>` único, `<h1>`, texto e canonical no HTML inicial; validação do sitemap gerado e do JSON-LD.
