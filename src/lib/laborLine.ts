/**
 * Mão de obra extra — fonte única de verdade.
 *
 * Orçamentos e ordens de serviço guardam as linhas (serviços/peças) em JSONB e,
 * separadamente, `labor_hours` (horas extra de mão de obra). O valor cobrado
 * pela mão de obra é `labor_hours × shops.labor_rate` e JÁ está incluído em
 * `subtotal` / `vat_total` / `total` do documento.
 *
 * Como não existe uma linha persistida para a mão de obra, cada superfície de
 * apresentação (página pública, PDF, email) tem de a renderizar como linha
 * virtual. Este módulo centraliza esse cálculo para não existirem lógicas
 * financeiras paralelas — nunca altera totais, apenas descreve a linha.
 */

export type DocumentLine = {
  type: string;
  name: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

/** IVA aplicado à mão de obra: herda o das linhas do documento (fallback 23%). */
export function laborVatRate(lines: unknown[]): number {
  const first = (Array.isArray(lines) ? lines : [])[0] as { vat_rate?: number } | undefined;
  const rate = Number(first?.vat_rate);
  return Number.isFinite(rate) ? rate : 23;
}

/** Valor cobrado de mão de obra extra (0 quando não aplicável). */
export function laborCharge(laborHours: unknown, laborRate: unknown): number {
  const h = Number(laborHours) || 0;
  const r = Number(laborRate) || 0;
  if (h <= 0 || r <= 0) return 0;
  return +(h * r).toFixed(2);
}

/**
 * Linha virtual de mão de obra, ou `null` quando não há mão de obra extra.
 * `label` permite localizar o nome ("Mão de obra" / "Labour" / "Mano de obra").
 */
export function laborChargeLine(
  lines: unknown[],
  laborHours: unknown,
  laborRate: unknown,
  label = "Mão de obra",
): DocumentLine | null {
  const charge = laborCharge(laborHours, laborRate);
  if (charge <= 0) return null;
  return {
    type: "labor",
    name: label,
    quantity: Number(laborHours) || 0,
    unit_price: Number(laborRate) || 0,
    vat_rate: laborVatRate(lines),
  };
}

/** Linhas do documento + linha virtual de mão de obra (quando aplicável). */
export function withLaborLine<T extends DocumentLine>(
  lines: T[],
  laborHours: unknown,
  laborRate: unknown,
  label = "Mão de obra",
): (T | DocumentLine)[] {
  const safe = Array.isArray(lines) ? lines : [];
  const labor = laborChargeLine(safe, laborHours, laborRate, label);
  return labor ? [...safe, labor] : safe;
}
