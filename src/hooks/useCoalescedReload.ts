import { useCallback, useEffect, useRef } from "react";

/**
 * Junta pedidos de recarregamento: vários eventos em tempo real (ou cliques)
 * seguidos resultam no máximo numa leitura em curso + uma leitura final.
 * Evita rajadas de dezenas de consultas que deixam a página "presa".
 */
export function useCoalescedReload(load: () => Promise<unknown> | unknown, delayMs = 500) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const running = useRef(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    if (running.current) { pending.current = true; return; }
    running.current = true;
    try { await loadRef.current(); } catch { /* erro já tratado pela página */ }
    finally {
      running.current = false;
      if (pending.current) { pending.current = false; void run(); }
    }
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void run(); }, delayMs);
  }, [run, delayMs]);
}
