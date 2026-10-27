import { describe, it, expect } from "vitest";
import { extractPortalToken } from "@/lib/clientAppLink";

const T = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";

describe("extractPortalToken", () => {
  it("aceita link completo do portal", () => {
    expect(extractPortalToken(`https://garageflow.pt/portal/${T}`)).toBe(T);
  });
  it("aceita link com parâmetros", () => {
    expect(extractPortalToken(`https://garageflow.pt/portal/${T}?lang=pt`)).toBe(T);
  });
  it("aceita apenas o código", () => {
    expect(extractPortalToken(T.toUpperCase())).toBe(T);
  });
  it("recusa links de outras páginas", () => {
    expect(extractPortalToken(`https://garageflow.pt/quote/x${T}x`)).toBeNull();
  });
  it("recusa texto sem código", () => {
    expect(extractPortalToken("olá")).toBeNull();
  });
});
