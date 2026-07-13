import { useCallback, useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc" | null;

export interface SortState {
  key: string | null;
  dir: SortDir;
}

export interface TableStateOptions<F extends Record<string, any>> {
  /** unique key for sessionStorage persistence (per page) */
  storageKey: string;
  /** default filter values */
  defaultFilters: F;
  /** default sort */
  defaultSort?: SortState;
  /** page size */
  pageSize?: number;
}

interface Persisted<F> {
  sort: SortState;
  filters: F;
  page: number;
}

function loadPersisted<F>(key: string): Persisted<F> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Persisted<F>) : null;
  } catch {
    return null;
  }
}

function savePersisted<F>(key: string, value: Persisted<F>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/**
 * Client-side sort + filter + pagination state, persisted per-session so a
 * refresh keeps the user's current view. Works with any row shape via
 * accessor functions supplied when calling `apply`.
 */
export function useTableState<F extends Record<string, any>>(opts: TableStateOptions<F>) {
  const { storageKey, defaultFilters, defaultSort = { key: null, dir: null }, pageSize = 50 } = opts;

  const persisted = loadPersisted<F>(storageKey);
  const [sort, setSort] = useState<SortState>(persisted?.sort ?? defaultSort);
  const [filters, setFilters] = useState<F>(persisted?.filters ?? defaultFilters);
  const [page, setPage] = useState<number>(persisted?.page ?? 0);

  useEffect(() => {
    savePersisted(storageKey, { sort, filters, page });
  }, [storageKey, sort, filters, page]);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      if (prev.dir === "desc") return { key: null, dir: null };
      return { key, dir: "asc" };
    });
    setPage(0);
  }, []);

  const updateFilter = useCallback(<K extends keyof F>(name: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPage(0);
  }, [defaultFilters]);

  const hasActiveFilters = useMemo(() => {
    return Object.keys(defaultFilters).some((k) => {
      const cur = (filters as any)[k];
      const def = (defaultFilters as any)[k];
      return cur !== def && cur !== "" && cur !== undefined && cur !== null;
    });
  }, [filters, defaultFilters]);

  /**
   * Apply the sort + pagination to a pre-filtered array.
   * Filtering is done in the page (custom logic), then paging is applied here.
   */
  const apply = useCallback(
    <T>(rows: T[], accessors: Record<string, (row: T) => any>) => {
      let out = rows;
      if (sort.key && sort.dir && accessors[sort.key]) {
        const acc = accessors[sort.key];
        out = [...rows].sort((a, b) => {
          const va = acc(a);
          const vb = acc(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === "number" && typeof vb === "number") {
            return sort.dir === "asc" ? va - vb : vb - va;
          }
          const sa = String(va).toLowerCase();
          const sb = String(vb).toLowerCase();
          return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
      }
      const total = out.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages - 1);
      const start = safePage * pageSize;
      const paged = out.slice(start, start + pageSize);
      return { rows: paged, total, totalPages, page: safePage, pageSize, start };
    },
    [sort, page, pageSize]
  );

  return {
    sort,
    filters,
    page,
    pageSize,
    setPage,
    toggleSort,
    updateFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,
    apply,
  };
}
