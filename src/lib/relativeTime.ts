/**
 * Returns a Portuguese relative-time string (e.g. "há 2 horas", "agora mesmo").
 * Designed to be used across listings, dashboards, and notifications.
 */
export function formatRelativePT(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return "agora mesmo";
  if (diffSec < 60) return `há ${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `há ${diffHr} ${diffHr === 1 ? "hora" : "horas"}`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    return `há ${w} ${w === 1 ? "semana" : "semanas"}`;
  }
  if (diffDays < 365) {
    const m = Math.floor(diffDays / 30);
    return `há ${m} ${m === 1 ? "mês" : "meses"}`;
  }
  const y = Math.floor(diffDays / 365);
  return `há ${y} ${y === 1 ? "ano" : "anos"}`;
}
