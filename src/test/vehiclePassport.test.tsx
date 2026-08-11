import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

const wait = async (fn: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return true;
    await new Promise(r => setTimeout(r, 20));
  }
  return false;
};
const text = () => (document.body.textContent || "").replace(/[\u00A0\u202F]/g, " ");
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
  return { supabase: { from: (t: string) => builder(t), auth: { getUser: async () => ({ data: { user: null } }) } } };
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

const renderPassport = async () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  await act(async () => {
    createRoot(el).render(<LanguageProvider><VehiclePassport vehicleId="v1" open onClose={() => {}} /></LanguageProvider>);
  });
};

describe("Passaporte do Veículo", () => {
  beforeEach(() => { localStorage.setItem("garageflow_language", "pt"); document.body.innerHTML = ""; });

  it("PT: matrícula, km, estados, orçamento, fatura e moeda", async () => {
    shopMeta = { currency: "EUR", country: "PT" };
    await renderPassport();
    expect(await wait(() => text().includes("41-EA-97"))).toBe(true);
    const t = text();
    expect(t).toContain("260.000 km");
    expect(t).toContain("Não registado");      // VIN ausente
    expect(t).toContain("1 intervenção");
    expect(t).toContain("Concluído");           // work_orders.status = completed
    expect(t).toContain("Emitida");             // invoices.status = issued
    expect(t).toContain("FAT-2026-0024");
    expect(t).toContain("ORC-0031");            // orçamento relacionado
    expect(t).toContain("Sem fotografias registadas.");
    expect(t).toContain("86,10 €");
    expect(t).toContain("NIF: 123456789");
    expect(t).not.toMatch(/\bissued\b|\bcompleted\b|\bowner\b|\bmileage\b/i);
  });

  it("BR: moeda BRL, CPF/CNPJ e km", async () => {
    shopMeta = { currency: "BRL", country: "BR" };
    vehicle.plate = "ABC1234"; invoices[0].currency = "BRL";
    localStorage.setItem("garageflow_language", "pt-BR");
    await renderPassport();
    expect(await wait(() => text().includes("R$"))).toBe(true);
    const t = text();
    expect(t).toContain("ABC-1234");
    expect(t).toContain("CPF/CNPJ");
    expect(t).toContain("260.000 km");
    expect(t).toContain("R$ 86,10");
  });

  it("ES: terminologia e identificador fiscal espanhol", async () => {
    shopMeta = { currency: "EUR", country: "ES" };
    vehicle.plate = "1234ABC"; invoices[0].currency = "EUR";
    localStorage.setItem("garageflow_language", "es");
    await renderPassport();
    expect(await wait(() => text().includes("Kilometraje"))).toBe(true);
    const t = text();
    expect(t).toContain("1234-ABC");
    expect(t).toContain("NIF/CIF");
    expect(t).toContain("Completado");
    expect(t).toContain("Emitida");
    expect(t).toContain("86,10 €");
  });

  it("PT: veículo sem serviços, sem faturas e sem fotografias", async () => {
    shopMeta = { currency: "EUR", country: "PT" };
    localStorage.setItem("garageflow_language", "pt");
    vehicle.plate = "41EA97";
    workOrders.length = 0;
    invoices.length = 0;
    await renderPassport();
    expect(await wait(() => text().includes("Sem intervenções registadas."))).toBe(true);
    const t = text();
    expect(t).toContain("Sem fotografias registadas.");
    expect(t).not.toContain("FAT-");
    expect(t).toContain("Não registado");
  });

  it("PT: veículo com VIN mostra o VIN real", async () => {
    shopMeta = { currency: "EUR", country: "PT" };
    localStorage.setItem("garageflow_language", "pt");
    (vehicle as any).vin = "WBAVA31050VS12345";
    await renderPassport();
    expect(await wait(() => text().includes("WBAVA31050VS12345"))).toBe(true);
  });
});
