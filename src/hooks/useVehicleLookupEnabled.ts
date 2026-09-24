import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Interruptor global da consulta por matrícula (Admin → Consultas de Matrículas).
 * Só esconde a interface; o bloqueio real é feito no servidor antes de qualquer pedido pago.
 * Enquanto carrega devolve false, para nunca mostrar e depois esconder.
 */
let cache: { value: boolean; at: number } | null = null;
const TTL = 60_000;
const listeners = new Set<(value: boolean) => void>();

async function readEnabled(): Promise<boolean> {
  const { data, error } = await supabase.rpc("vehicle_lookup_enabled" as any);
  // Fail closed: the lookup control must never appear when the real setting
  // cannot be confirmed.
  return !error && data === true;
}

function publish(value: boolean) {
  cache = { value, at: Date.now() };
  listeners.forEach((listener) => listener(value));
}

export function useVehicleLookupEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cache && Date.now() - cache.at < TTL ? cache.value : false);
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const value = await readEnabled();
      if (alive) publish(value);
    };
    const onChange = (value: boolean) => { if (alive) setEnabled(value); };
    listeners.add(onChange);

    if (cache && Date.now() - cache.at < TTL) setEnabled(cache.value);
    else void sync();

    const interval = window.setInterval(() => { void sync(); }, TTL);
    const channel = supabase
      .channel("vehicle-lookup-global-setting")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings", filter: "key=eq.vehicle_lookup" }, () => { void sync(); })
      .subscribe();

    return () => {
      alive = false;
      listeners.delete(onChange);
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);
  return enabled;
}

export function invalidateVehicleLookupEnabled() {
  cache = null;
  void readEnabled().then(publish);
}
