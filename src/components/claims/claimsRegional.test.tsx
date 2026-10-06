import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ClaimSplitBilling } from "./ClaimSplitBilling";
import { ClaimImmobilization, daysBetween } from "./ClaimImmobilization";
import { waPhone } from "./ClaimClientInformed";
import { setCountryCode } from "@/lib/regionConfig";
import { clientMessageForPhase } from "@/lib/claimPhases";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
describe("Sinistros: Portugal e Brasil", () => {
  const claim = { id: "test", insurer_id: "insurer", amount_approved: 1000, deductible: 100 };
  it("Portugal mantém faturação em euros e nota legal portuguesa", () => {
    setCountryCode("PT");
    const html = renderToStaticMarkup(<MemoryRouter><ClaimSplitBilling claim={claim} shopId="test" sups={[]} isBR={false} onChanged={() => {}} /></MemoryRouter>);
    expect(html).toContain("900,00");
    expect(html).toContain("100,00");
    expect(html).toContain("€");
    expect(html).toContain("DL 291/2007");
    expect(html).toContain("Emitir fatura à seguradora");
  });
  it("Brasil usa reais e notas fiscais sem prazos legais portugueses", () => {
    setCountryCode("BR");
    const html = renderToStaticMarkup(<MemoryRouter><ClaimSplitBilling claim={claim} shopId="test" sups={[]} isBR onChanged={() => {}} /></MemoryRouter>);
    expect(html).toContain("R$");
    expect(html).toContain("Emitir nota fiscal à seguradora");
    expect(html).not.toContain("DL 291/2007");
    expect(html).not.toContain("€");
    setCountryCode("PT");
  });
  it("uma autorização recusada não permite faturar o valor legado", () => {
    const html = renderToStaticMarkup(<MemoryRouter><ClaimSplitBilling claim={claim} shopId="test" sups={[{ id: "s", type: "inicial", number: 0, description: "x", amount_requested: 1000, amount_approved: null, status: "rejected", requested_at: "2026-10-01" }]} isBR={false} onChanged={() => {}} /></MemoryRouter>);
    expect(html).not.toContain("900,00");
  });
  it("dias de imobilização param na data de saída", () => {
    expect(daysBetween("2026-09-25", "2026-10-06")).toBe(11);
    expect(daysBetween("2026-10-06", "2026-09-25")).toBe(0);
    const html = renderToStaticMarkup(<ClaimImmobilization claim={{ id: "x", vehicle_in_date: "2026-09-25", vehicle_out_date: "2026-10-06" }} isBR onSaved={() => {}} />);
    expect(html).toContain("Veículo de substituição");
  });
  it("WhatsApp usa indicativo correto e não inventa telefone", () => {
    expect(waPhone("912345678", false)).toBe("351912345678");
    expect(waPhone("11987654321", true)).toBe("5511987654321");
    expect(waPhone(null, false)).toBeNull();
  });
  it("mensagens brasileiras mantêm vocabulário brasileiro", () => {
    expect(clientMessageForPhase("reparacao", true, false)).toContain("reparando o seu veículo");
    expect(clientMessageForPhase("reparacao", false, false)).toContain("a reparar a sua viatura");
  });
});