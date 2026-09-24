import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Interruptor global da consulta por matrícula (Admin → Consultas de Matrículas).
 * Só esconde a interface; o bloqueio real é feito no servidor antes de qualquer pedido pago.
 * Enquanto carrega devolve false, para nunca mostrar e depois esconder.
 */
let cache: { value: boolean; at: number } | null = null;
const TTL = 60_000;

export function useVehicleLookupEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cache && Date.now() - cache.at < TTL ? cache.value : false);
  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL) { setEnabled(cache.value); return; }
    let alive = true;
    supabase.rpc("vehicle_lookup_enabled" as any).then(({ data, error }) => {
      const v = !error && data !== false;
      cache = { value: v, at: Date.now() };
      if (alive) setEnabled(v);
    });
    return () => { alive = false; };
  }, []);
  return enabled;
}

export function invalidateVehicleLookupEnabled() { cache = null; }
