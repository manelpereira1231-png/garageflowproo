---
name: Global SEO Worldwide Launch
description: Sistema SEO mundial — hreflang 10 locais, sitemap multi-país, meta dinâmicas, OG images, JSON-LD multi-currency
type: feature
---
O GarageFlow está pronto para lançamento mundial com SEO 100% otimizado:

## Componente central
- `src/components/SEOHead.tsx` — injeta title/description/keywords/canonical/hreflang/OG/Twitter/JSON-LD por idioma e realm (erp ou market)
- `src/lib/seoConfig.ts` — dicionário de meta para 8 idiomas (pt, pt-BR, en, es, fr, de, it, hi) e mapa hreflang com 10 locais (pt-PT, pt-BR, en-US, en-GB, es-ES, es-MX, fr-FR, de-DE, it-IT, hi-IN)
- `src/main.tsx` — envolve `<App />` em `<HelmetProvider>`

## Sitemaps
- `public/sitemap.xml` — sitemap index
- `public/sitemap-erp.xml` — landing + auth + legais com hreflang completo
- `public/sitemap-market.xml` — 30+ marcas globais (Tesla, Honda, Tata, Mahindra, Maruti…), 35+ modelos populares, 60+ cidades em 9 países (PT, BR, ES, FR, DE, IT, UK, US, IN)

## Meta inicial
- `index.html` — JSON-LD Organization (sameAs LinkedIn/Twitter/FB/IG, areaServed 10 países, knowsLanguage 8), WebSite (SearchAction), SoftwareApplication (offers em EUR/BRL/USD/GBP/INR), hreflang fallback completo
- OG images profissionais: `/public/og-image.jpg` (ERP) e `/public/og-market.jpg` (Market) em 1216x640

## Robots & well-known
- `public/robots.txt` — bots internacionais (Yandex, Baidu, Applebot, DuckDuckBot, LinkedInBot, WhatsApp, Telegram), bloqueio de AI scrapers (GPTBot, CCBot, anthropic-ai, ClaudeBot)
- `public/.well-known/security.txt` — RFC 9116 compliance
- `public/humans.txt` — credits

## Como usar em novas páginas
```tsx
import SEOHead from "@/components/SEOHead";
<SEOHead realm="market" path="/market/make/BMW" breadcrumbs={[...]} jsonLd={{...}} />
```

## Pontos críticos
- Phone tracking removido `+351` hardcoded do gtag (link_attribution mantido)
- Idioma do `<html lang>` é atualizado dinamicamente pelo SEOHead
- Toda a página (LandingPage e CarityMarketplace) já tem SEOHead injetado
