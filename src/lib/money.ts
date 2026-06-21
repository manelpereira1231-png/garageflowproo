// Formatação monetária consistente em toda a aplicação (pt-PT, EUR).
// Regra global: separador decimal ",", 2 casas decimais, símbolo "€" como sufixo.
//
// Exemplos:
//   formatMoney(0.69)         -> "0,69 €"
//   formatMoney(35)           -> "35,00 €"
//   formatHourlyRate(35)      -> "35,00 €/h"
//   formatHours(0)            -> "0,0h"

const eurFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const hoursFormatter = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatMoney(value: number | null | undefined): string {
  const n = typeof value === "number" && isFinite(value) ? value : 0;
  // Intl pt-PT returns "0,69 €" already in the correct format.
  return eurFormatter.format(n);
}

export function formatHourlyRate(rate: number | null | undefined): string {
  return `${formatMoney(rate)}/h`;
}

export function formatHours(hours: number | null | undefined): string {
  const n = typeof hours === "number" && isFinite(hours) ? hours : 0;
  return `${hoursFormatter.format(n)}h`;
}

export function formatLaborCostLine(seconds: number, hourlyRate: number) {
  const hours = (seconds || 0) / 3600;
  const cost = hours * (hourlyRate || 0);
  return {
    cost: formatMoney(cost),
    hours: formatHours(hours),
    rate: formatHourlyRate(hourlyRate),
    // Linha completa pronta a mostrar:
    line: `${formatMoney(cost)} (${formatHours(hours)} × ${formatHourlyRate(hourlyRate)})`,
  };
}
