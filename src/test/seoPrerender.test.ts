// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sitemapXml } from "../../plugins/seo-prerender";

describe("ERP sitemap page timestamps", () => {
  it("omits lastmod when a page has no authoritative timestamp", () => {
    const xml = sitemapXml([{ loc: "https://garageflow.pt/erp", priority: "0.8" }]);
    expect(xml).not.toContain("<lastmod>");
    expect(xml).toContain("<loc>https://garageflow.pt/erp</loc>");
  });
  it("preserves a page-specific publication timestamp", () => {
    const xml = sitemapXml([{ loc: "https://garageflow.pt/blog/como-organizar-uma-oficina-automovel", lastmod: "2026-05-01", priority: "0.7" }]);
    expect(xml).toContain("<lastmod>2026-05-01</lastmod>");
  });
});