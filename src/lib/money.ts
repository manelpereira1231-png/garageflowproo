// Formatação monetária global e multi-país.
//
// Regra de ouro: NUNCA hardcode "€" ou "EUR" em componentes/páginas.
// Toda a UI deve usar formatMoney() / formatHourlyRate() / formatHours().
// A moeda e o locale são obtidos automaticamente do país ativo
// (getCountryConfig() -> country_settings), com override opcional por chamada.
//
// Exemplos (país ativo = PT):
//   formatMoney(0.69)         -> "0,69 €"
//   formatMoney(1234.5)       -> "1234,50 €"
//   formatHourlyRate(35)      -> "35,00 €/h"
//   formatHours(0)            -> "0,0h"
//
// Exemplos (país ativo = BR):
//   formatMoney(0.69)         -> "R$ 0,69"
//   formatMoney(1234.5)       -> "R$ 1.234,50"
//
// Override explícito (para PDFs/emails de uma oficina específica):
//   formatMoney(35, "USD", "en-US") -> "$35.00"

import { getCountryConfig } from "./regionConfig";

type MaybeNumber = number | null | undefined;

function coerce(value: MaybeNumber): number {
  return typeof value === "number" && isFinite(value) ? value : 0;
}

function resolveCurrency(currency?: string): { currency: string; locale: string } {
  if (currency) {
    // Se só passaram currency, usamos locale do país ativo para separadores.
    const c = getCountryConfig();
    return { currency, locale: c.locale };
  }
  const c = getCountryConfig();
  return { currency: c.currency || "EUR", locale: c.locale || "pt-PT" };
}

/**
 * Formata um valor monetário. Se currency/locale não forem passados,
 * usa o país ativo (country_settings + override do utilizador).
 */
export function formatMoney(
  value: MaybeNumber,
  currency?: string,
  locale?: string,
): string {
  const n = coerce(value);
  const resolved = resolveCurrency(currency);
  const finalLocale = locale || resolved.locale;
  try {
    return new Intl.NumberFormat(finalLocale, {
      style: "currency",
      currency: resolved.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // Locale inválido — fallback silencioso para pt-PT/EUR.
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }
}

export function formatHourlyRate(
  rate: MaybeNumber,
  currency?: string,
  locale?: string,
): string {
  return `${formatMoney(rate, currency, locale)}/h`;
}

export function formatHours(hours: MaybeNumber, locale?: string): string {
  const n = coerce(hours);
  const finalLocale = locale || getCountryConfig().locale || "pt-PT";
  try {
    return `${new Intl.NumberFormat(finalLocale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n)}h`;
  } catch {
    return `${n.toFixed(1)}h`;
  }
}

export function formatLaborCostLine(
  seconds: number,
  hourlyRate: number,
  currency?: string,
  locale?: string,
) {
  const hours = (seconds || 0) / 3600;
  const cost = hours * (hourlyRate || 0);
  return {
    cost: formatMoney(cost, currency, locale),
    hours: formatHours(hours, locale),
    rate: formatHourlyRate(hourlyRate, currency, locale),
    line: `${formatMoney(cost, currency, locale)} (${formatHours(hours, locale)} × ${formatHourlyRate(hourlyRate, currency, locale)})`,
  };
}
