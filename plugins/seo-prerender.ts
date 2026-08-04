/**
 * seo-prerender — pré-renderização estática (SSG) das rotas públicas de SEO.
 *
 * Porque existe: a app é uma SPA Vite/React. Sem isto, o Googlebot recebe o mesmo
 * index.html vazio (`<div id="root"></div>`) em todas as ~290 URLs de SEO, com o mesmo
 * <title> genérico e sem conteúdo — a causa do estado "Descoberta, atualmente não indexada".
 *
 * O que faz, no fim do build (`closeBundle`):
 *   1. compila os módulos de dados (puros, sem React) com esbuild e carrega-os em Node;
 *   2. escreve `dist/<rota>/index.html` com <title>, description, canonical, hreflang,
 *      JSON-LD e o CONTEÚDO REAL em HTML (h1, intro, secções, FAQ, links internos);
 *   3. gera `sitemap-erp.xml` e `sitemap.xml` a partir das mesmas fontes de dados.
 *
 * O React continua a assumir a página na hidratação — não há alteração visual nem de UX.
 */
import { build as esbuild } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import path from "path";
import type { Plugin } from "vite";

const SITE = "https://garageflow.pt";

const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface PageDoc {
  /** rota sem barra inicial, ex: "blog/como-gerir-clientes-recorrentes" */
  route: string;
  title: string;
  description: string;
  keywords?: string;
  ogType: "website" | "article";
  h1: string;
  /** blocos de conteúdo já em HTML (dentro de <article>) */
  bodyHtml: string;
  jsonLd: Record<string, unknown>[];
  lastmod?: string;
  priority: string;
}

const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GarageFlow",
  url: SITE,
  logo: `${SITE}/og-image.jpg`,
  sameAs: ["https://garageflow.pt"],
};

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GarageFlow",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: SITE,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    description: "30 dias de teste grátis, sem cartão de crédito.",
  },
};

const crumbs = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((b, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: b.name,
    item: b.url,
  })),
});

const list = (items: { title: string; desc: string }[]) =>
  `<ul>${items.map((i) => `<li><strong>${esc(i.title)}</strong> — ${esc(i.desc)}</li>`).join("")}</ul>`;

const paras = (ps: string[]) => ps.map((p) => `<p>${esc(p)}</p>`).join("");

const faqHtml = (faqs: { q: string; a: string }[]) =>
  `<section><h2>Perguntas frequentes</h2>${faqs
    .map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`)
    .join("")}</section>`;

const linksHtml = (title: string, links: { label: string; to: string }[]) =>
  links.length
    ? `<nav aria-label="${esc(title)}"><h2>${esc(title)}</h2><ul>${links
        .map((l) => `<li><a href="${esc(l.to)}">${esc(l.label)}</a></li>`)
        .join("")}</ul></nav>`
    : "";

async function loadData(root: string) {
  const tmp = path.join(root, "node_modules", ".seo-prerender", "data.mjs");
  mkdirSync(path.dirname(tmp), { recursive: true });
  await esbuild({
    entryPoints: [path.join(root, "src/lib/seoPrerenderData.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    outfile: tmp,
    logLevel: "silent",
  });
  const mod = await import(`file://${tmp}?t=${Date.now()}`);
  try {
    rmSync(path.dirname(tmp), { recursive: true, force: true });
  } catch {
    /* noop */
  }
  return mod as {
    SEO_PAGES: any[];
    SEO_CITIES: { slug: string; name: string; region: string }[];
    BLOG_POSTS: any[];
    INTENT_COPY: Record<string, any>;
  };
}

function buildDocs(data: Awaited<ReturnType<typeof loadData>>): PageDoc[] {
  const docs: PageDoc[] = [];
  const home = { name: "Início", url: `${SITE}/` };

  // ---------- Landing pages de SEO ----------
  for (const p of data.SEO_PAGES) {
    const url = `${SITE}/${p.slug}`;
    docs.push({
      route: p.slug,
      title: p.title,
      description: p.description,
      keywords: p.keywords,
      ogType: "article",
      h1: p.h1,
      priority: "0.8",
      bodyHtml: [
        paras(p.intro),
        `<section><h2>Como o GarageFlow resolve isto</h2>${paras(p.solution)}</section>`,
        `<section><h2>Vantagens</h2>${list(p.benefits)}</section>`,
        `<section><h2>Funcionalidades</h2>${list(p.features)}</section>`,
        faqHtml(p.faqs),
        linksHtml("Páginas relacionadas", p.related ?? []),
        `<p><a href="/auth?mode=signup">${esc(p.ctaLabel ?? "Testar grátis 30 dias")}</a> · <a href="/blog">Blog GarageFlow</a></p>`,
      ].join(""),
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: p.faqs.map((f: any) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
        SOFTWARE_LD,
        ORG_LD,
        crumbs([home, { name: p.h1, url }]),
      ],
    });
  }

  // ---------- Páginas por cidade (4 intenções × cidades) ----------
  for (const intent of Object.keys(data.INTENT_COPY)) {
    const copy = data.INTENT_COPY[intent];
    for (const city of data.SEO_CITIES) {
      const route = `${copy.prefix}/${city.slug}`;
      const url = `${SITE}/${route}`;
      const faqs = [
        copy.uniqueFaq(city.name),
        { q: "Preciso de internet rápida?", a: "Não. Funciona bem em ligações normais." },
        {
          q: "Posso experimentar antes de pagar?",
          a: "Sim. 30 dias grátis com acesso a tudo, sem cartão de crédito.",
        },
      ];
      const related = [
        { label: `Oficinas em ${city.name}`, to: `/oficinas/${city.slug}` },
        { label: `Gestão de oficinas em ${city.name}`, to: `/gestao-oficinas/${city.slug}` },
        { label: `ERP para oficinas em ${city.name}`, to: `/erp-automovel/${city.slug}` },
        { label: `Software para oficinas em ${city.name}`, to: `/software-oficinas/${city.slug}` },
      ].filter((r) => r.to !== `/${route}`);

      docs.push({
        route,
        title: copy.title(city.name),
        description: copy.description(city.name, city.region),
        ogType: "article",
        h1: copy.h1(city.name),
        priority: "0.6",
        bodyHtml: [
          `<p>${esc(city.name)} · ${esc(city.region)}</p>`,
          paras(copy.intro(city.name, city.region)),
          `<section><h2>O GarageFlow em ${esc(city.region)}</h2>${paras(
            copy.solution(city.name, city.region),
          )}</section>`,
          faqHtml(faqs),
          linksHtml(`Oficinas em ${city.name}`, related),
          linksHtml("Guias GarageFlow", [
            { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
            { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
            { label: "Blog GarageFlow", to: "/blog" },
          ]),
        ].join(""),
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: `GarageFlow — ${city.name}`,
            description: `Software de gestão para oficinas automóveis em ${city.name} (${city.region}).`,
            url,
            areaServed: { "@type": "City", name: city.name },
            address: {
              "@type": "PostalAddress",
              addressLocality: city.name,
              addressRegion: city.region,
              addressCountry: "PT",
            },
          },
          crumbs([home, { name: city.name, url }]),
        ],
      });
    }
  }

  // ---------- Blog ----------
  docs.push({
    route: "blog",
    title: "Blog GarageFlow — Gestão de oficinas automóveis",
    description:
      "Guias práticos sobre gestão de oficinas automóveis: organização, orçamentos, faturação, clientes e produtividade.",
    ogType: "website",
    h1: "Blog GarageFlow",
    priority: "0.7",
    bodyHtml: [
      `<p>Guias práticos para quem gere uma oficina automóvel em Portugal.</p>`,
      `<ul>${data.BLOG_POSTS.map(
        (b: any) =>
          `<li><a href="/blog/${esc(b.slug)}"><strong>${esc(b.title)}</strong></a> — ${esc(
            b.excerpt,
          )}</li>`,
      ).join("")}</ul>`,
      linksHtml("Guias GarageFlow", [
        { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
        { label: "ERP para oficinas automóveis", to: "/erp-oficina-automovel" },
        { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
      ]),
    ].join(""),
    jsonLd: [
      ORG_LD,
      crumbs([{ name: "Início", url: `${SITE}/` }, { name: "Blog", url: `${SITE}/blog` }]),
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Blog GarageFlow",
        url: `${SITE}/blog`,
        blogPost: data.BLOG_POSTS.map((b: any) => ({
          "@type": "BlogPosting",
          headline: b.title,
          url: `${SITE}/blog/${b.slug}`,
          datePublished: b.publishedAt,
        })),
      },
    ],
  });

  for (const b of data.BLOG_POSTS) {
    const url = `${SITE}/blog/${b.slug}`;
    docs.push({
      route: `blog/${b.slug}`,
      title: b.title,
      description: b.description,
      ogType: "article",
      h1: b.title,
      lastmod: b.publishedAt,
      priority: "0.7",
      bodyHtml: [
        `<p>${esc(b.excerpt)}</p>`,
        b.sections
          .map((s: any) => `<section><h2>${esc(s.h2)}</h2>${paras(s.body)}</section>`)
          .join(""),
        linksHtml("Artigos e páginas relacionadas", b.related ?? []),
        `<p><a href="/blog">Ver todos os artigos</a> · <a href="/auth?mode=signup">Testar grátis 30 dias</a></p>`,
      ].join(""),
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: b.title,
          description: b.description,
          articleSection: b.category,
          datePublished: b.publishedAt,
          dateModified: b.publishedAt,
          wordCount: b.sections.reduce(
            (n: number, s: any) => n + s.body.join(" ").split(/\s+/).length,
            0,
          ),
          inLanguage: "pt-PT",
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          author: { "@type": "Organization", name: "GarageFlow", url: SITE },
          publisher: ORG_LD,
          image: `${SITE}/og-image.jpg`,
        },
        crumbs([
          { name: "Início", url: `${SITE}/` },
          { name: "Blog", url: `${SITE}/blog` },
          { name: b.title, url },
        ]),
      ],
    });
  }

  // ---------- Rotas core (homepage e páginas institucionais) ----------
  const topPages = data.SEO_PAGES.slice(0, 8).map((p: any) => ({
    label: p.h1 ?? p.title,
    to: `/${p.slug}`,
  }));
  const topCities = data.SEO_CITIES.slice(0, 10).map((c) => ({
    label: `Software para oficinas em ${c.name}`,
    to: `/oficinas/${c.slug}`,
  }));
  const topPosts = data.BLOG_POSTS.slice(0, 6).map((b: any) => ({
    label: b.title,
    to: `/blog/${b.slug}`,
  }));

  const CORE_DOCS: PageDoc[] = [
    {
      route: "",
      title: "GarageFlow | Software de Gestão para Oficinas Automóveis",
      description:
        "Software completo para oficinas automóveis: orçamentos, ordens de serviço, faturação, stock, agenda e clientes. Teste 30 dias grátis, sem cartão.",
      ogType: "website",
      h1: "Software de gestão para oficinas automóveis",
      priority: "1.0",
      bodyHtml: [
        paras([
          "O GarageFlow é um software de gestão para oficinas automóveis que reúne clientes, viaturas, orçamentos, ordens de serviço, faturação e stock num único sistema, acessível em computador, tablet e telemóvel.",
          "Foi desenhado para oficinas independentes e redes de oficinas em Portugal, Brasil e Europa, com fluxo de trabalho linear: registar o cliente, associar a viatura, criar o orçamento e converter em serviço aprovado.",
        ]),
        `<section><h2>O que o GarageFlow faz</h2>${list([
          { title: "Orçamentos e aprovação digital", desc: "envio ao cliente, aprovação com assinatura e conversão automática em ordem de serviço." },
          { title: "Ordens de serviço", desc: "estados de trabalho, mão de obra, peças e histórico completo por viatura." },
          { title: "Faturação", desc: "documentos com numeração sequencial, impostos por país e exportação contabilística." },
          { title: "Stock e peças", desc: "inventário, alertas de stock mínimo e consumo automático nos serviços." },
          { title: "Agenda e marcações online", desc: "portal público de marcação e lembretes automáticos ao cliente." },
          { title: "Multi-oficina", desc: "gestão de várias oficinas do mesmo grupo com dados isolados e visão consolidada." },
        ])}</section>`,
        faqHtml([
          { q: "O GarageFlow funciona em telemóvel?", a: "Sim. É uma aplicação web responsiva e instalável (PWA), pensada primeiro para uso móvel dentro da oficina." },
          { q: "Preciso de instalar alguma coisa?", a: "Não. Funciona no navegador, com os dados na cloud e cópias de segurança automáticas." },
          { q: "Posso experimentar antes de pagar?", a: "Sim, há 30 dias de teste sem necessidade de cartão de crédito." },
        ]),
        linksHtml("Guias e soluções", topPages),
        linksHtml("Oficinas por cidade", topCities),
        linksHtml("Artigos do blog", topPosts),
      ].join(""),
      jsonLd: [ORG_LD, SOFTWARE_LD, crumbs([home])],
    },
    {
      route: "erp",
      title: "ERP para Oficinas Automóveis | GarageFlow",
      description:
        "ERP para oficinas automóveis: clientes, viaturas, orçamentos, serviços, faturação, stock e relatórios num só sistema cloud.",
      ogType: "website",
      h1: "ERP para oficinas automóveis",
      priority: "0.8",
      bodyHtml: [
        paras([
          "O ERP do GarageFlow centraliza toda a operação da oficina: da entrada da viatura à faturação, passando pelo controlo de peças e pela produtividade dos mecânicos.",
          "Cada módulo comunica com os restantes, o que elimina a duplicação de dados típica das folhas de cálculo e dos cadernos em papel.",
        ]),
        `<section><h2>Módulos do ERP</h2>${list([
          { title: "Operação", desc: "agenda, ordens de serviço, inspeções digitais e histórico por viatura." },
          { title: "Comercial", desc: "orçamentos, aprovação digital, portal do cliente e lembretes de manutenção." },
          { title: "Financeiro", desc: "faturação, recebimentos, relatórios e exportações fiscais." },
          { title: "Inventário", desc: "peças, fornecedores, custos e alertas de reposição." },
        ])}</section>`,
        linksHtml("Ver também", [...topPages.slice(0, 5), { label: "Blog GarageFlow", to: "/blog" }]),
      ].join(""),
      jsonLd: [ORG_LD, SOFTWARE_LD, crumbs([home, { name: "ERP", url: `${SITE}/erp` }])],
    },
    {
      route: "demo",
      title: "Demonstração do GarageFlow | Ver o software em ação",
      description:
        "Veja como o GarageFlow gere orçamentos, serviços e faturação numa oficina automóvel. Demonstração e teste gratuito de 30 dias.",
      ogType: "website",
      h1: "Demonstração do GarageFlow",
      priority: "0.6",
      bodyHtml: [
        paras([
          "A demonstração mostra o percurso real de uma reparação no GarageFlow: registo do cliente e da viatura, orçamento enviado e aprovado digitalmente, ordem de serviço executada e fatura emitida.",
          "Pode também criar uma conta de teste e experimentar com dados próprios durante 30 dias, sem cartão de crédito.",
        ]),
        linksHtml("Explorar antes da demonstração", [...topPages.slice(0, 4), { label: "Blog GarageFlow", to: "/blog" }]),
      ].join(""),
      jsonLd: [ORG_LD, SOFTWARE_LD, crumbs([home, { name: "Demonstração", url: `${SITE}/demo` }])],
    },
    {
      route: "afiliados",
      title: "Programa de Afiliados GarageFlow | Ganhe comissões",
      description:
        "Recomende o GarageFlow a oficinas automóveis e receba comissões recorrentes. Programa de afiliados com painel próprio e acompanhamento de resultados.",
      ogType: "website",
      h1: "Programa de afiliados GarageFlow",
      priority: "0.6",
      bodyHtml: [
        paras([
          "O programa de afiliados do GarageFlow permite a consultores, contabilistas, fornecedores de peças e criadores de conteúdo receberem comissões recorrentes por cada oficina que se torne cliente.",
          "Cada afiliado tem um link próprio, um painel com métricas de conversão e acompanhamento das comissões geradas.",
        ]),
        linksHtml("Saber mais sobre o produto", topPages.slice(0, 4)),
      ].join(""),
      jsonLd: [ORG_LD, crumbs([home, { name: "Afiliados", url: `${SITE}/afiliados` }])],
    },
    {
      route: "support",
      title: "Apoio ao Cliente GarageFlow | Suporte para oficinas",
      description:
        "Suporte GarageFlow para oficinas automóveis: abertura de pedidos de ajuda, dúvidas de configuração, faturação e utilização do sistema.",
      ogType: "website",
      h1: "Apoio ao cliente GarageFlow",
      priority: "0.4",
      bodyHtml: [
        paras([
          "A equipa de apoio do GarageFlow ajuda em configuração inicial, importação de dados, faturação, gestão de equipa e utilização diária do sistema.",
          "Os pedidos são registados com histórico, para que qualquer membro da equipa possa acompanhar o estado da resposta.",
        ]),
        linksHtml("Recursos úteis", [{ label: "Blog GarageFlow", to: "/blog" }, ...topPages.slice(0, 3)]),
      ].join(""),
      jsonLd: [ORG_LD, crumbs([home, { name: "Apoio ao cliente", url: `${SITE}/support` }])],
    },
  ];
  docs.push(...CORE_DOCS);

  return docs;
}

function renderHtml(template: string, doc: PageDoc): string {
  const url = `${SITE}/${doc.route}`;
  const head = [
    `<title>${esc(doc.title)}</title>`,
    `<meta name="description" content="${esc(doc.description)}" />`,
    doc.keywords ? `<meta name="keywords" content="${esc(doc.keywords)}" />` : "",
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="pt-PT" href="${url}" />`,
    `<link rel="alternate" hreflang="x-default" href="${url}" />`,
    `<meta property="og:type" content="${doc.ogType}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(doc.title)}" />`,
    `<meta property="og:description" content="${esc(doc.description)}" />`,
    `<meta name="twitter:title" content="${esc(doc.title)}" />`,
    `<meta name="twitter:description" content="${esc(doc.description)}" />`,
    ...doc.jsonLd.map(
      (ld) =>
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    ),
  ]
    .filter(Boolean)
    .join("\n    ");

  let html = template;
  // remover head tags estáticos que este documento substitui (título/description/og genéricos)
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    .replace(/<meta\s+name="keywords"[^>]*>/i, "")
    .replace(/<meta\s+property="og:type"[^>]*>/i, "")
    .replace(/<meta\s+property="og:title"[^>]*>/i, "")
    .replace(/<meta\s+property="og:description"[^>]*>/i, "")
    .replace(/<meta\s+name="twitter:title"[^>]*>/i, "")
    .replace(/<meta\s+name="twitter:description"[^>]*>/i, "")
    // remover hreflang e canonical estáticos (apontam para a homepage) — cada página emite os seus
    .replace(/<link\s+rel="alternate"\s+hreflang=[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "");

  html = html.replace("</head>", `  ${head}\n  </head>`);

  // O conteúdo SSG vive dentro de #root (o React substitui-o ao montar) mas por baixo do
  // splash `#gf-boot` do template — assim o utilizador nunca vê o HTML sem estilos, e o
  // crawler continua a receber o conteúdo completo no primeiro byte.
  const bootSplash =
    template.match(/<div id="gf-boot"[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
  const body =
    `<div id="root"><main><article>` +
    `<h1>${esc(doc.h1)}</h1>` +
    doc.bodyHtml +
    `</article></main>${bootSplash}</div>`;
  html = html.replace(/<div id="root">[\s\S]*?<\/div><\/div>\s*<\/div>|<div id="root">[\s\S]*?<\/div>\s*(?=\s*<script)/, body);
  return html;
}

function sitemapXml(entries: { loc: string; lastmod: string; priority: string }[]) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map((e) =>
      [
        `  <url>`,
        `    <loc>${e.loc}</loc>`,
        `    <lastmod>${e.lastmod}</lastmod>`,
        `    <priority>${e.priority}</priority>`,
        `  </url>`,
      ].join("\n"),
    ),
    `</urlset>`,
  ].join("\n");
}

/** Rotas públicas estáticas do ERP que não são geradas por dados. */
const CORE_ROUTES: { path: string; priority: string }[] = [
  { path: "/", priority: "1.0" },
  { path: "/erp", priority: "0.8" },
  { path: "/afiliados", priority: "0.6" },
  { path: "/demo", priority: "0.6" },
  { path: "/gratis-3-meses", priority: "0.5" },
  { path: "/support", priority: "0.4" },
  { path: "/legal/privacy", priority: "0.3" },
  { path: "/legal/terms", priority: "0.3" },
  { path: "/legal/cookies", priority: "0.3" },
];

export default function seoPrerender(): Plugin {
  let root = process.cwd();
  let outDir = "dist";

  return {
    name: "garageflow-seo-prerender",
    apply: "build",
    configResolved(cfg) {
      root = cfg.root;
      outDir = cfg.build.outDir;
    },
    async closeBundle() {
      const dist = path.resolve(root, outDir);
      const templatePath = path.join(dist, "index.html");
      if (!existsSync(templatePath)) return;
      const template = readFileSync(templatePath, "utf8");

      const data = await loadData(root);
      const docs = buildDocs(data);

      for (const doc of docs) {
        const dir = path.join(dist, doc.route);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "index.html"), renderHtml(template, doc), "utf8");
      }

      // ---------- sitemaps ----------
      const today = new Date().toISOString().slice(0, 10);
      const rawEntries = [
        ...docs.map((d) => ({
          loc: `${SITE}/${d.route}`,
          lastmod: d.lastmod ?? today,
          priority: d.priority,
        })),
        ...CORE_ROUTES.map((r) => ({
          loc: `${SITE}${r.path}`,
          lastmod: today,
          priority: r.priority,
        })),
      ];
      // desduplicar por URL (as rotas core pré-renderizadas já entram via docs)
      const seen = new Set<string>();
      const entries = rawEntries.filter((e) => !seen.has(e.loc) && seen.add(e.loc));
      const erpXml = sitemapXml(entries);
      writeFileSync(path.join(dist, "sitemap-erp.xml"), erpXml, "utf8");
      writeFileSync(path.resolve(root, "public/sitemap-erp.xml"), erpXml, "utf8");

      const index = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        `  <sitemap>\n    <loc>${SITE}/sitemap-erp.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
        `  <sitemap>\n    <loc>${SITE}/sitemap-market.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
        `</sitemapindex>`,
      ].join("\n");
      writeFileSync(path.join(dist, "sitemap.xml"), index, "utf8");
      writeFileSync(path.resolve(root, "public/sitemap.xml"), index, "utf8");

      this.warn?.(`[seo-prerender] ${docs.length} páginas pré-renderizadas, ${entries.length} URLs no sitemap`);
      console.log(
        `[seo-prerender] ${docs.length} páginas pré-renderizadas · sitemap com ${entries.length} URLs`,
      );
    },
  };
}
