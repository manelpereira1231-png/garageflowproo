/**
 * Scheduling Engine — motor de sugestão inteligente de horários.
 * Reutiliza service_catalog (duração), shops.opening_hours (horário),
 * appointments + work_orders (ocupação) e staff_absences (férias/pausas).
 */
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO } from "date-fns";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface OpeningDay {
  open: string | null;
  close: string | null;
  break: [string, string] | null;
}
export type OpeningHours = Record<(typeof DAY_KEYS)[number], OpeningDay>;

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  mon: { open: "09:00", close: "18:00", break: ["13:00", "14:00"] },
  tue: { open: "09:00", close: "18:00", break: ["13:00", "14:00"] },
  wed: { open: "09:00", close: "18:00", break: ["13:00", "14:00"] },
  thu: { open: "09:00", close: "18:00", break: ["13:00", "14:00"] },
  fri: { open: "09:00", close: "18:00", break: ["13:00", "14:00"] },
  sat: { open: null, close: null, break: null },
  sun: { open: null, close: null, break: null },
};

interface Interval { start: number; end: number; mechanic?: string | null }

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const overlap = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export async function getBusyIntervals(
  shopId: string,
  date: string,
  mechanicId?: string | null
): Promise<Interval[]> {
  const startAt = `${date}T00:00:00`;
  const endAt = `${date}T23:59:59`;

  const [apptRes, absRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("time,duration_minutes,assigned_to,status")
      .eq("shop_id", shopId)
      .eq("date", date)
      .neq("status", "cancelled"),
    supabase
      .from("staff_absences" as any)
      .select("user_id,start_at,end_at")
      .eq("shop_id", shopId)
      .lte("start_at", endAt)
      .gte("end_at", startAt),
  ]);

  const busy: Interval[] = [];
  (apptRes.data || []).forEach((a: any) => {
    if (mechanicId && a.assigned_to && a.assigned_to !== mechanicId) return;
    const start = toMin(String(a.time).slice(0, 5));
    busy.push({ start, end: start + (a.duration_minutes || 60), mechanic: a.assigned_to });
  });
  (absRes.data || []).forEach((r: any) => {
    if (mechanicId && r.user_id !== mechanicId) return;
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    const dateStart = new Date(`${date}T00:00:00`);
    const dateEnd = new Date(`${date}T23:59:59`);
    if (e < dateStart || s > dateEnd) return;
    const startMin = s < dateStart ? 0 : s.getHours() * 60 + s.getMinutes();
    const endMin = e > dateEnd ? 24 * 60 : e.getHours() * 60 + e.getMinutes();
    busy.push({ start: startMin, end: endMin, mechanic: r.user_id });
  });
  return busy;
}

function dayWindows(day: OpeningDay): [number, number][] {
  if (!day.open || !day.close) return [];
  const open = toMin(day.open);
  const close = toMin(day.close);
  if (day.break && day.break[0] && day.break[1]) {
    return [
      [open, toMin(day.break[0])],
      [toMin(day.break[1]), close],
    ];
  }
  return [[open, close]];
}

export interface SlotSuggestion {
  date: string;
  time: string;
  mechanicId?: string | null;
  label: string;
}

/**
 * Suggests up to `limit` slots starting from `preferredDate`, scanning
 * forward up to 14 days. Respects opening hours, service duration and
 * conflicts across appointments/absences.
 */
export async function suggestSlots(params: {
  shopId: string;
  durationMinutes: number;
  openingHours: OpeningHours;
  preferredDate: string; // yyyy-MM-dd
  mechanicId?: string | null;
  mechanics?: { id: string; label: string }[];
  limit?: number;
}): Promise<SlotSuggestion[]> {
  const { shopId, durationMinutes, openingHours, preferredDate, mechanicId, mechanics = [], limit = 3 } = params;
  const results: SlotSuggestion[] = [];

  for (let offset = 0; offset < 14 && results.length < limit; offset++) {
    const day = addDays(parseISO(preferredDate), offset);
    const dayKey = DAY_KEYS[day.getDay()];
    const opening = openingHours[dayKey] || DEFAULT_OPENING_HOURS[dayKey];
    const windows = dayWindows(opening);
    if (!windows.length) continue;

    const dateStr = format(day, "yyyy-MM-dd");

    // Pick mechanics to try: specific one, or each mechanic in turn, or "any"
    const candidates: (string | null)[] = mechanicId
      ? [mechanicId]
      : mechanics.length
      ? mechanics.map((m) => m.id)
      : [null];

    for (const mech of candidates) {
      const busy = await getBusyIntervals(shopId, dateStr, mech);
      for (const [wStart, wEnd] of windows) {
        // step in 15-min increments
        for (let t = wStart; t + durationMinutes <= wEnd; t += 15) {
          const slot: Interval = { start: t, end: t + durationMinutes };
          if (busy.some((b) => overlap(b, slot))) continue;
          const mechLabel = mech
            ? mechanics.find((m) => m.id === mech)?.label || ""
            : "";
          results.push({
            date: dateStr,
            time: fromMin(t),
            mechanicId: mech,
            label: `${dateStr} · ${fromMin(t)}${mechLabel ? ` · ${mechLabel}` : ""}`,
          });
          if (results.length >= limit) return results;
          break; // one slot per (day, mechanic, window)
        }
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

export async function detectConflict(params: {
  shopId: string;
  date: string;
  time: string;
  durationMinutes: number;
  mechanicId?: string | null;
  excludeId?: string;
}): Promise<boolean> {
  const { shopId, date, time, durationMinutes, mechanicId, excludeId } = params;
  const t = toMin(time.slice(0, 5));
  const slot: Interval = { start: t, end: t + durationMinutes };

  let q = supabase
    .from("appointments")
    .select("id,time,duration_minutes,assigned_to,status")
    .eq("shop_id", shopId)
    .eq("date", date)
    .neq("status", "cancelled");
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data || []).some((a: any) => {
    if (mechanicId && a.assigned_to && a.assigned_to !== mechanicId) return false;
    const start = toMin(String(a.time).slice(0, 5));
    return overlap({ start, end: start + (a.duration_minutes || 60) }, slot);
  });
}
