import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "garageflow_sidebar_width";
export const SIDEBAR_MIN_WIDTH = 76;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_DEFAULT_WIDTH = 256;
/** Abaixo deste valor o menu passa a mostrar apenas ícones. */
export const SIDEBAR_COMPACT_THRESHOLD = 150;

const clamp = (v: number) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(v)));

/**
 * Largura do menu lateral controlada pelo utilizador (arrasto na pega direita).
 * Persistida em localStorage — mantém-se ao navegar entre páginas e sessões.
 */
export function useResizableSidebar() {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clamp(parsed) : SIDEBAR_DEFAULT_WIDTH;
  });
  const [resizing, setResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const widthRef = useRef(width);
  widthRef.current = width;


  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setResizing(true);

    const onMove = (ev: PointerEvent) => setWidth(clamp(ev.clientX));
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      } catch {
        /* storage indisponível — ignora */
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  // Evita seleção de texto / cursor errado durante o arrasto
  useEffect(() => {
    if (!resizing) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [resizing]);

  const setWidthPersisted = useCallback((next: number) => {
    const v = clamp(next);
    setWidth(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignora */
    }
  }, []);

  return {
    width,
    resizing,
    startResize,
    setWidth: setWidthPersisted,
    compact: isDesktop && width < SIDEBAR_COMPACT_THRESHOLD,
  };
}
