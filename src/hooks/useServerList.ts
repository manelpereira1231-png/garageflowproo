import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ServerListOptions {
  /** Table to read from. */
  table: string;
  /** Active shop — the query is always scoped to it. Null → no query. */
  shopId: string | null;
  /** PostgREST select expression (joins allowed). */
  select: string;
  /** 0-based page index. */
  page: number;
  pageSize: number;
  /** Column used for ordering. */
  orderBy: string;
  ascending?: boolean;
  /** Free-text search term (debounced by the caller or by this hook). */
  search?: string;
  /** Columns matched with ILIKE against `search` (OR). */
  searchColumns?: string[];
  /** Equality filters. Undefined/null/"" values are ignored. */
  eq?: Record<string, string | number | boolean | null | undefined>;
  /** `IN (...)` filters. Empty/undefined arrays are ignored. */
  inFilters?: Record<string, (string | number)[] | undefined>;
  /** Adds `deleted_at IS NULL`. */
  notDeleted?: boolean;
  /** Bump to force a refetch (e.g. realtime signal). */
  refreshKey?: number | string;
  /** Debounce applied to the search term, in ms. */
  debounceMs?: number;
}

export interface ServerListResult<T> {
  rows: T[];
  total: number;
  loading: boolean;
  /** True while a search term is typed but not yet applied. */
  searching: boolean;
  refetch: () => void;
}

function escapeIlike(term: string) {
  // PostgREST `or=` uses commas/parentheses as syntax — strip them from user input.
  return term.replace(/[,()*%\\]/g, " ").trim();
}

/**
 * Server-side pagination + search + sort for large shop-scoped lists.
 *
 * Replaces the previous "fetch up to 2000 rows and filter in the browser"
 * pattern: only one page of rows ever reaches the client, and both the search
 * and the total count are computed by Postgres.
 */
export function useServerList<T = any>(opts: ServerListOptions): ServerListResult<T> {
  const {
    table, shopId, select, page, pageSize, orderBy, ascending = false,
    search = "", searchColumns = [], eq, inFilters, notDeleted, refreshKey,
    debounceMs = 300,
  } = opts;

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const requestId = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), search ? debounceMs : 0);
    return () => window.clearTimeout(id);
  }, [search, debounceMs]);

  const eqKey = JSON.stringify(eq ?? {});
  const inKey = JSON.stringify(inFilters ?? {});
  const searchColsKey = searchColumns.join(",");

  const run = useCallback(async () => {
    if (!shopId) { setRows([]); setTotal(0); setLoading(false); return; }
    const myId = ++requestId.current;
    setLoading(true);
    try {
      let q = supabase
        .from(table as any)
        .select(select, { count: "exact" })
        .eq("shop_id", shopId);

      if (notDeleted) q = q.is("deleted_at", null);

      const eqObj: Record<string, any> = JSON.parse(eqKey);
      for (const [col, val] of Object.entries(eqObj)) {
        if (val === undefined || val === null || val === "") continue;
        q = q.eq(col, val as any);
      }

      const inObj: Record<string, any[]> = JSON.parse(inKey);
      for (const [col, vals] of Object.entries(inObj)) {
        if (!Array.isArray(vals) || vals.length === 0) continue;
        q = q.in(col, vals as any);
      }

      const term = escapeIlike(debouncedSearch || "");
      if (term && searchColumns.length > 0) {
        q = q.or(searchColumns.map((c) => `${c}.ilike.%${term}%`).join(","));
      }

      const from = page * pageSize;
      const { data, count, error } = await q
        .order(orderBy, { ascending })
        .range(from, from + pageSize - 1);

      if (myId !== requestId.current) return; // stale response
      if (error) throw error;
      setRows((data as any) ?? []);
      setTotal(count ?? 0);
    } catch {
      if (myId === requestId.current) { setRows([]); setTotal(0); }
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, shopId, select, page, pageSize, orderBy, ascending, debouncedSearch, searchColsKey, eqKey, inKey, notDeleted, refreshKey]);

  useEffect(() => { void run(); }, [run]);

  return { rows, total, loading, searching: search !== debouncedSearch, refetch: run };
}
