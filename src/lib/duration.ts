/**
 * Duration helpers for quotes / work orders.
 *
 * Estimated time comes from the service catalog (`default_time`, in minutes).
 * Quote/work-order lines are stored as JSONB, so we persist `est_minutes` on
 * each service line when it's picked from the catalog. For legacy documents
 * (created before `est_minutes` existed) we fall back to parsing the
 * "(45 min)" suffix that the picker appends to the line name.
 */

/** Extracts "(45 min)" from a line name. Returns 0 when absent. */
export function parseMinutesFromName(name?: string | null): number {
  const m = /\((\d+)\s*min\)\s*$/i.exec(name || "");
  return m ? Number(m[1]) || 0 : 0;
}

/** Estimated minutes for a single document line (already multiplied by qty). */
export function lineEstMinutes(line: any): number {
  if (!line || line.type !== "service") return 0;
  const per = Number(line.est_minutes) || parseMinutesFromName(line.name);
  const qty = Number(line.quantity) || 0;
  return per * qty;
}

/**
 * Total estimated minutes = catalog time of the service lines
 * + extra labour hours entered manually.
 */
export function totalEstMinutes(lines: any[], laborHours: number | string = 0): number {
  const fromLines = (Array.isArray(lines) ? lines : []).reduce((s, l) => s + lineEstMinutes(l), 0);
  const extra = (Number(laborHours) || 0) * 60;
  return Math.round(fromLines + extra);
}

/** Human readable duration: 90 → "1h30", 45 → "45 min", 120 → "2h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return "0 min";
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
