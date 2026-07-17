/**
 * usePlanNames — reads plan display names from the `plans` table so admin
 * edits (e.g. renaming "Free" to "Start") propagate to Landing, Billing and
 * anywhere else that renders a plan label. Falls back to the provided
 * translation label when the DB row is missing.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PlanName = { slug: string; name: string };

let cache: Record<string, string> | null = null;
const listeners = new Set<(m: Record<string, string>) => void>();

async function loadPlanNames() {
  // Only surface names of active, non-archived plans so a deactivated plan
  // never leaks its label into Landing / Billing / Upgrade dialogs.
  const { data } = await supabase
    .from("plans")
    .select("slug, name, active, archived_at")
    .eq("active", true)
    .is("archived_at", null);
  const map: Record<string, string> = {};
  (data as Array<{ slug: string; name: string }> | null)?.forEach((r) => {
    if (r.slug && r.name) map[r.slug] = r.name;
  });
  cache = map;
  listeners.forEach((cb) => cb(map));
  return map;
}

export function usePlanNames() {
  const [names, setNames] = useState<Record<string, string>>(cache ?? {});

  useEffect(() => {
    const cb = (m: Record<string, string>) => setNames(m);
    listeners.add(cb);
    if (!cache) void loadPlanNames();
    else setNames(cache);

    const onUpdate = () => void loadPlanNames();
    window.addEventListener("garageflow:pricing-updated", onUpdate);

    const ch = supabase
      .channel("plans-names")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => void loadPlanNames())
      .subscribe();

    return () => {
      listeners.delete(cb);
      window.removeEventListener("garageflow:pricing-updated", onUpdate);
      void supabase.removeChannel(ch);
    };
  }, []);

  return {
    names,
    /** Get plan display name by slug, falling back to `fallback`. */
    getName: (slug: string, fallback: string) => names[slug] || fallback,
  };
}
