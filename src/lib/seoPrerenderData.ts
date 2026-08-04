// Ponto de entrada único de dados para o pré-render estático (build-time).
// Só reexporta módulos de dados puros (sem React, sem browser APIs) para poderem
// ser carregados em Node durante o build.
export { SEO_PAGES, SEO_CITIES } from "./seoPagesPT";
export type { SeoPageContent } from "./seoPagesPT";
export { BLOG_POSTS } from "./seoBlogPT";
export type { BlogPost } from "./seoBlogPT";
export { INTENT_COPY } from "./seoCityCopy";
export type { Intent } from "./seoCityCopy";
