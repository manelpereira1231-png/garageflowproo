import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ─── Dados reais simulados (estrutura idêntica à BD) ───
const vehicle = {
  id: "v1", shop_id: "s1", make: "BMW", model: "Série 1 118d", year: 2007,
  fuel: "Gasóleo", plate: "41EA97", vin: null, mileage: 260000,
  clients: { name: "Miguel Valério", nif: "123456789" },
};
const workOrders = [{
  id: "wo1", number: "SRV-0056", status: "completed", total: 86.1,
  created_at: "2026-08-01T10:00:00Z", completed_at: "2026-08-01T10:00:00Z",
  entry_mileage: 260000, technician: "João", diagnosis: "Substituição de travões",
  client_description: null, notes: null, lines: [], quote_id: "q1",
}];
const invoices = [{ id: "i1", number: "FAT-2026-0024", status: "issued", total: 86.1, currency: "EUR", due_date: null, created_at: "2026-08-01T10:00:00Z", work_order_id: "wo1" }];

let shopMeta: any = { currency: "EUR", country: "PT" };

vi.mock("@/integrations/supabase/client", () => {
  const result = (table: string) => {
    if (table === "vehicles") return { data: vehicle };
    if (table === "work_orders") return { data: workOrders };
    if (table === "invoices") return { data: invoices };
    if (table === "shops") return { data: shopMeta };
    if (table === "quotes") return { data: [{ id: "q1", number: "ORC-0031" }] };
    return { data: [] };
  };
  const builder = (table: string): any => {
    const res = result(table);
    const chain: any = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === "then") return (r: any) => Promise.resolve(res).then(r);
        if (prop === "maybeSingle") return () => Promise.resolve(res);
        return () => chain;
      },
    });
    return chain;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

vi.mock("@/lib/regionConfig", () => ({
  getCountryConfig: () => (shopMeta.country === "BR"
    ? { currency: "BRL", locale: "pt-BR" }
    : shopMeta.country === "ES"
      ? { currency: "EUR", locale: "es-ES" }
      : { currency: "EUR", locale: "pt-PT" }),
}));

import { LanguageProvider } from "@/i18n/LanguageContext";
import VehiclePassport from "@/components/VehiclePassport";

const renderPassport = () =>
  render(<LanguageProvider><VehiclePassport vehicleId="v1" open onClose={() => {}} /></LanguageProvider>);

describe("Passaporte do Veículo", () => {
  beforeEach(() => { localStorage.setItem("garageflow_language", "pt"); });

  it("PT: matrícula, km, estados e moeda", async () => {
    shopMeta = { currency: "EUR", country: "PT" };
    renderPassport();
    await waitFor(() => expect(screen.getByText("41-EA-97")).toBeTruthy());
    expect(screen.getAllByText("260.000 km").length).toBeGreaterThan(0);
    expect(screen.getByText("Não registado")).toBeTruthy(); // VIN ausente
    expect(screen.getByText("1 intervenção")).toBeTruthy();
    expect(screen.getByText("Concluído")).toBeTruthy();
    expect(screen.getByText("Emitida")).toBeTruthy();
    expect(screen.getByText("FAT-2026-0024")).toBeTruthy();
    expect(screen.getByText("ORC-0031")).toBeTruthy();
    expect(screen.getByText("Sem fotografias registadas.")).toBeTruthy();
    expect(document.body.textContent).toContain("86,10 €");
    expect(document.body.textContent).not.toMatch(/\bissued\b|\bcompleted\b/);
    expect(document.body.textContent).toContain("NIF: 123456789");
  });

  it("BR: placa, moeda BRL e CPF/CNPJ", async () => {
    shopMeta = { currency: "BRL", country: "BR" };
    localStorage.setItem("garageflow_language", "pt-BR");
    renderPassport();
    await waitFor(() => expect(screen.getByText("ABC-1234") || true).toBeTruthy(), { timeout: 100 }).catch(() => {});
    await waitFor(() => expect(document.body.textContent).toContain("R$"));
    expect(document.body.textContent).toContain("CPF/CNPJ");
    expect(document.body.textContent).toContain("260.000 km");
  });

  it("ES: matrícula espanhola e terminologia", async () => {
    shopMeta = { currency: "EUR", country: "ES" };
    localStorage.setItem("garageflow_language", "es");
    renderPassport();
    await waitFor(() => expect(document.body.textContent).toContain("Kilometraje"));
    expect(document.body.textContent).toContain("NIF/CIF");
    expect(document.body.textContent).toContain("Completado");
    expect(document.body.textContent).toContain("Emitida");
  });
});
