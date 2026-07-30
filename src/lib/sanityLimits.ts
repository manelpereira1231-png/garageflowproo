/**
 * Limites de sanidade para campos numéricos do ERP.
 *
 * Não são regras fiscais — são travões contra erros de digitação
 * (ex.: 33.333 horas de mão-de-obra, 1.111.111 km) que contaminam
 * orçamentos, faturas e relatórios financeiros.
 */

/** Horas de mão-de-obra por documento (orçamento/serviço). */
export const MAX_LABOR_HOURS = 100;

/** Quantidade por linha de orçamento/fatura. */
export const MAX_LINE_QUANTITY = 9999;

/** Preço unitário por linha. */
export const MAX_UNIT_PRICE = 1_000_000;

/** Quilometragem de um veículo. */
export const MAX_MILEAGE = 600_000;

/** Duração estimada de um serviço, em minutos (≈ 100h). */
export const MAX_SERVICE_MINUTES = 6000;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
