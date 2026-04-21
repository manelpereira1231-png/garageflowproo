/**
 * Global SEO Configuration
 * Multi-language, multi-region SEO for worldwide launch
 */

export const SITE_URL = "https://garageflow.pt";
export const SITE_NAME = "GarageFlow";

// Hreflang map: ISO language-region codes Google requires
export const HREFLANG_LOCALES = [
  { code: "pt-PT", lang: "pt", region: "PT" },
  { code: "pt-BR", lang: "pt-BR", region: "BR" },
  { code: "en-US", lang: "en", region: "US" },
  { code: "en-GB", lang: "en", region: "GB" },
  { code: "es-ES", lang: "es", region: "ES" },
  { code: "es-MX", lang: "es", region: "MX" },
  { code: "fr-FR", lang: "fr", region: "FR" },
  { code: "de-DE", lang: "de", region: "DE" },
  { code: "it-IT", lang: "it", region: "IT" },
  { code: "hi-IN", lang: "hi", region: "IN" },
] as const;

export type SeoLang = "pt" | "pt-BR" | "en" | "es" | "fr" | "de" | "it" | "hi";

// Per-language meta content (ERP landing)
export const ERP_META: Record<SeoLang, { title: string; description: string; keywords: string }> = {
  pt: {
    title: "Software Gestão Oficina Automóvel | GarageFlow",
    description: "GarageFlow: software de gestão para oficinas automóvel. Orçamentos, ordens de serviço, faturação, clientes e alertas inteligentes. Teste grátis 30 dias.",
    keywords: "software oficina, gestão oficina automóvel, ERP oficina mecânica, ordens de serviço, faturação oficina",
  },
  "pt-BR": {
    title: "Software de Gestão para Oficina Mecânica | GarageFlow",
    description: "GarageFlow: sistema completo para oficinas mecânicas no Brasil. Orçamentos, ordens de serviço, NFe, clientes e estoque. Teste grátis 30 dias.",
    keywords: "software oficina mecânica, sistema oficina, ERP oficina Brasil, ordem de serviço, gestão oficina",
  },
  en: {
    title: "Auto Repair Shop Management Software | GarageFlow",
    description: "GarageFlow: complete management software for auto repair shops. Quotes, work orders, invoicing, customers and smart alerts. 30-day free trial.",
    keywords: "auto repair software, garage management software, workshop management, work orders, repair shop ERP",
  },
  es: {
    title: "Software de Gestión para Talleres Mecánicos | GarageFlow",
    description: "GarageFlow: software completo para talleres mecánicos. Presupuestos, órdenes de trabajo, facturación, clientes y alertas. Prueba gratis 30 días.",
    keywords: "software taller mecánico, gestión taller, ERP taller automoción, órdenes de trabajo, facturación taller",
  },
  fr: {
    title: "Logiciel de Gestion pour Garage Automobile | GarageFlow",
    description: "GarageFlow : logiciel complet de gestion pour garages automobiles. Devis, ordres de travail, facturation, clients et alertes. Essai gratuit 30 jours.",
    keywords: "logiciel garage, gestion garage auto, ERP atelier mécanique, ordres de travail, facturation garage",
  },
  de: {
    title: "Werkstatt-Management-Software für Kfz-Betriebe | GarageFlow",
    description: "GarageFlow: komplette Software für Kfz-Werkstätten. Angebote, Aufträge, Rechnungen, Kunden und intelligente Erinnerungen. 30 Tage kostenlos testen.",
    keywords: "werkstatt software, kfz werkstatt management, autowerkstatt ERP, auftragsverwaltung, werkstatt rechnung",
  },
  it: {
    title: "Software Gestione Officina Meccanica | GarageFlow",
    description: "GarageFlow: software completo per officine meccaniche. Preventivi, ordini di lavoro, fatturazione, clienti e avvisi intelligenti. Prova gratis 30 giorni.",
    keywords: "software officina, gestione officina meccanica, ERP officina auto, ordini di lavoro, fatturazione officina",
  },
  hi: {
    title: "Auto Repair Shop Management Software | GarageFlow",
    description: "GarageFlow: complete software for car workshops in India. Quotes, job cards, GST invoicing, customers and smart alerts. 30-day free trial.",
    keywords: "garage management software India, auto repair software, workshop ERP India, job card software, GST invoice garage",
  },
};

// Per-language meta content (Market)
export const MARKET_META: Record<SeoLang, { title: string; description: string; keywords: string }> = {
  pt: {
    title: "GarageFlow Market — Comprar e Vender Carros com Inspeção",
    description: "GarageFlow Market: marketplace de carros usados com inspeção obrigatória por oficinas certificadas e pagamento seguro com escrow. Sem burlas. Por GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, comprar carro usado, vender carro, marketplace automóvel, carros com inspeção, pagamento seguro carro",
  },
  "pt-BR": {
    title: "GarageFlow Market — Comprar e Vender Carros com Vistoria",
    description: "GarageFlow Market: marketplace de carros seminovos e usados com vistoria por oficinas credenciadas e pagamento protegido. Sem golpes. Por GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, comprar carro usado, vender carro, marketplace carros, vistoria carro, pagamento seguro carro",
  },
  en: {
    title: "GarageFlow Market — Buy & Sell Inspected Used Cars",
    description: "GarageFlow Market: trusted used-car marketplace with mandatory inspection by certified garages and secure escrow payment. By GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, used cars marketplace, buy used car, sell my car, inspected used cars, secure car payment escrow",
  },
  es: {
    title: "GarageFlow Market — Comprar y Vender Coches con Inspección",
    description: "GarageFlow Market: marketplace de coches usados con inspección obligatoria por talleres certificados y pago seguro con escrow. Por GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, comprar coche usado, vender coche, marketplace coches, coches inspeccionados, pago seguro coche",
  },
  fr: {
    title: "GarageFlow Market — Acheter et Vendre des Voitures Inspectées",
    description: "GarageFlow Market : marketplace de voitures d'occasion avec inspection obligatoire par garages certifiés et paiement sécurisé. Par GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, acheter voiture occasion, vendre voiture, marketplace auto, voitures inspectées, paiement sécurisé auto",
  },
  de: {
    title: "GarageFlow Market — Geprüfte Gebrauchtwagen Kaufen & Verkaufen",
    description: "GarageFlow Market: Marktplatz für Gebrauchtwagen mit Pflichtinspektion durch zertifizierte Werkstätten und sicherer Treuhand-Zahlung. Von GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, gebrauchtwagen kaufen, auto verkaufen, gebrauchtwagen marktplatz, geprüfte gebrauchtwagen, sichere autozahlung",
  },
  it: {
    title: "GarageFlow Market — Comprare e Vendere Auto Ispezionate",
    description: "GarageFlow Market: marketplace di auto usate con ispezione obbligatoria da officine certificate e pagamento sicuro con escrow. Da GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, comprare auto usata, vendere auto, marketplace auto, auto ispezionate, pagamento sicuro auto",
  },
  hi: {
    title: "GarageFlow Market — Buy & Sell Inspected Used Cars in India",
    description: "GarageFlow Market: trusted used-car marketplace in India with mandatory inspection by certified garages and secure escrow payment. By GarageFlow.",
    keywords: "GarageFlow Market, garageflowmarket, garage flow market, used cars India, buy second hand car, sell my car India, inspected used cars, secure car marketplace",
  },
};

// Map app language code -> SEO language key
export function toSeoLang(lang: string): SeoLang {
  if (lang === "pt-BR") return "pt-BR";
  if (["pt", "en", "es", "fr", "de", "it", "hi"].includes(lang)) return lang as SeoLang;
  return "pt";
}

// Map app language to og:locale
export function toOgLocale(lang: SeoLang): string {
  const map: Record<SeoLang, string> = {
    pt: "pt_PT",
    "pt-BR": "pt_BR",
    en: "en_US",
    es: "es_ES",
    fr: "fr_FR",
    de: "de_DE",
    it: "it_IT",
    hi: "hi_IN",
  };
  return map[lang];
}
