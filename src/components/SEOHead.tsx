import { Helmet } from "react-helmet-async";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  ERP_META,
  MARKET_META,
  HREFLANG_LOCALES,
  SITE_URL,
  SITE_NAME,
  toSeoLang,
  toOgLocale,
} from "@/lib/seoConfig";

interface SEOHeadProps {
  /** "erp" (default) or "market" — picks meta dictionary */
  realm?: "erp" | "market";
  /** Override the title (otherwise uses dictionary) */
  title?: string;
  /** Override the description */
  description?: string;
  /** Path on the site (e.g. /market/make/BMW). Defaults to current pathname. */
  path?: string;
  /** Override the OG image (default: /og-image.jpg or /og-market.jpg) */
  image?: string;
  /** noindex tag (e.g. on /admin or auth flows) */
  noindex?: boolean;
  /** Optional structured data (JSON-LD object) */
  jsonLd?: Record<string, any> | Record<string, any>[];
  /** Optional breadcrumbs for BreadcrumbList JSON-LD */
  breadcrumbs?: Array<{ name: string; url: string }>;
}

/**
 * SEOHead — drop in any page to inject:
 *  - <title>, <meta description/keywords>
 *  - canonical
 *  - Full hreflang map (10 locales)
 *  - OG / Twitter (locale-aware)
 *  - JSON-LD (custom + breadcrumbs)
 */
export default function SEOHead({
  realm = "erp",
  title,
  description,
  path,
  image,
  noindex,
  jsonLd,
  breadcrumbs,
}: SEOHeadProps) {
  const { language } = useLanguage();
  const seoLang = toSeoLang(language);
  const dict = realm === "market" ? MARKET_META[seoLang] : ERP_META[seoLang];

  const currentPath =
    path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const cleanPath = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  const fullUrl = `${SITE_URL}${cleanPath}`;
  const ogImage = image
    ? image.startsWith("http") ? image : `${SITE_URL}${image}`
    : `${SITE_URL}${realm === "market" ? "/og-market.jpg" : "/og-image.jpg"}`;

  const finalTitle = title || dict.title;
  const finalDesc = description || dict.description;
  const ogLocale = toOgLocale(seoLang);

  const breadcrumbLd = breadcrumbs && breadcrumbs.length
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: b.url.startsWith("http") ? b.url : `${SITE_URL}${b.url}`,
        })),
      }
    : null;

  const jsonLdArray: Record<string, any>[] = [];
  if (jsonLd) {
    if (Array.isArray(jsonLd)) jsonLdArray.push(...jsonLd);
    else jsonLdArray.push(jsonLd);
  }
  if (breadcrumbLd) jsonLdArray.push(breadcrumbLd);

  return (
    <Helmet>
      <html lang={seoLang === "pt-BR" ? "pt-BR" : seoLang === "hi" ? "hi-IN" : seoLang} />
      <title>{finalTitle}</title>
      <meta name="description" content={finalDesc} />
      <meta name="keywords" content={dict.keywords} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}

      <link rel="canonical" href={fullUrl} />

      {/* Hreflang — o site serve um único URL por rota (sem URLs por idioma).
          Emitir 10 hreflang diferentes para o MESMO href é um conflito que o
          Google ignora, por isso mantém-se apenas o self-reference + x-default. */}
      <link rel="alternate" hrefLang={seoLang === "pt-BR" ? "pt-BR" : seoLang} href={fullUrl} />
      <link rel="alternate" hrefLang="x-default" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDesc} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={ogLocale} />
      {HREFLANG_LOCALES.filter((l) => toOgLocale(l.lang as any) !== ogLocale).map((l) => (
        <meta key={l.code} property="og:locale:alternate" content={toOgLocale(l.lang as any)} />
      ))}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@GarageFlowPro" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDesc} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLdArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}
