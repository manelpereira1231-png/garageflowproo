import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "garageflow_sidebar_collapsed";
export const SIDEBAR_MIN_WIDTH = 76;
export const SIDEBAR_DEFAULT_WIDTH = 256;

/**
 * Menu lateral com largura fixa (256px) e um modo compacto (só ícones) no
 * desktop, alternado por botão. Sem arrasto — o menu deslizante foi removido
 * por pedido do utilizador.
 */
export function useResizableSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage indisponível — ignora */
      }
      return next;
    });
  }, []);

  const compact = isDesktop && collapsed;

  return {
    width: compact ? SIDEBAR_MIN_WIDTH : SIDEBAR_DEFAULT_WIDTH,
    compact,
    toggle,
  };
}
