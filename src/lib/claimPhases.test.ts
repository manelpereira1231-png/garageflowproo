import { describe, expect, it } from "vitest";
import { addBusinessDays, authorizedTotal, computeRepairPhase, computeTotalLossPhase, nextStep, ptDeadlines, type Sup } from "./claimPhases";

const sup = (patch: Partial<Sup>): Sup => ({ id: "test", type: "inicial", number: 0, description: "Teste", amount_requested: 100, amount_approved: 80, status: "partial", requested_at: "2026-10-01", ...patch });
describe("Sinistros: fases e autorizações", () => {
  it("soma apenas valores efetivamente autorizados", () => {
    expect(authorizedTotal([sup({}), sup({ status: "pending", amount_approved: 500 }), sup({ status: "rejected", amount_approved: 500 })])).toBe(80);
  });
  it("preserva estados antigos sem alterar o registo", () => {
    const claim = { status: "waiting_invoice" };
    expect(computeRepairPhase(claim, { sups: [] })).toBe("faturacao");
    expect(claim.status).toBe("waiting_invoice");
  });
  it("autoriza reparação e aguarda adicionais pendentes", () => {
    expect(computeRepairPhase({ status: "new" }, { sups: [sup({})] })).toBe("reparacao");
    expect(computeRepairPhase({ status: "repairing" }, { sups: [sup({ type: "adicional", status: "pending" })] })).toBe("autorizacao");
  });
  it("respeita correção manual e fecho", () => {
    expect(computeRepairPhase({ status: "repairing", phase_override: "entrada" }, { sups: [], billedAndPaid: true })).toBe("entrada");
    expect(computeRepairPhase({ status: "waiting_invoice" }, { sups: [], billedAndPaid: true })).toBe("fechado");
    expect(nextStep({ status: "done" }, "fechado", [sup({ status: "pending" })], [], false)).toBe("processo encerrado");
  });
  it("mantém decisão antiga de ficar com o salvado", () => {
    expect(computeTotalLossPhase({ status: "new", client_decision: "keep_salvage" })).toBe("encargos");
  });
});
describe("Prazos portugueses", () => {
  it("exclui fins de semana e o feriado de 5 de outubro", () => {
    expect(addBusinessDays("2026-10-02", 1).toISOString().slice(0, 10)).toBe("2026-10-06");
  });
  it("não inventa prazo quando falta a data da participação", () => {
    expect(ptDeadlines({}, []).find(d => d.id === "expert")?.limit).toBeNull();
  });
  it("conta desde o fim do prazo do contacto, com DAAA", () => {
    const d = ptDeadlines({ report_date: "2026-10-02", first_contact_at: "2026-10-02", has_daaa: true }, []).find(d => d.id === "expert");
    expect(d?.limit?.toISOString().slice(0, 10)).toBe("2026-10-13");
  });
});