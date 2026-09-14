import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Permite que alertas e notificações abram uma listagem já pesquisada pelo
 * identificador real (ex.: /invoices?search=FT-2026/12). O parâmetro é
 * consumido uma única vez e removido do URL.
 */
export function useUrlSearchFilter(apply: (value: string) => void) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const value = searchParams.get("search")?.trim();
    if (!value) return;
    apply(value);
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
