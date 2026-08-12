import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShopTechnician {
  name: string | null;
  email: string | null;
  /** Valor a guardar/mostrar — nome do perfil quando existe */
  label: string;
}

/** Mostra sempre o nome do técnico; só usa o email como último recurso. */
export function technicianDisplay(value: string | null | undefined, byEmail: Map<string, string>): string {
  const v = (value || "").trim();
  if (!v) return "";
  const mapped = byEmail.get(v.toLowerCase());
  if (mapped) return mapped;
  // Sem perfil associado: nunca mostrar o domínio do email
  if (v.includes("@")) return v.split("@")[0].replace(/[._-]+/g, " ").trim();
  return v;
}

/**
 * Técnicos registados da oficina (membros de equipa ativos).
 * Fonte única para todos os seletores de técnico do ERP — evita nomes
 * escritos manualmente à mão que não correspondem a ninguém registado.
 */
export function useShopTechnicians(shopId?: string | null) {
  const [rows, setRows] = useState<ShopTechnician[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!shopId) { setRows([]); return; }
    setLoading(true);
    (async () => {
      try {
        const { data: members } = await supabase
          .from("shop_users")
          .select("id, user_id, role, shop_user_profiles(name, active)")
          .eq("shop_id", shopId);
        if (!members?.length) { if (!cancelled) setRows([]); return; }
        const { data: emailData } = await supabase.rpc("get_shop_member_emails", { _shop_id: shopId });
        const emailMap = new Map((emailData || []).map((e: any) => [e.user_id, e.email]));
        const list: ShopTechnician[] = members
          .filter((m: any) => (m.shop_user_profiles?.active ?? true))
          .map((m: any) => {
            const name = (m.shop_user_profiles?.name || "").trim() || null;
            const email = ((emailMap.get(m.user_id) as string) || "").trim() || null;
            return { name, email, label: name || (email ? email.split("@")[0] : "") };
          })
          .filter((r) => r.label);
        if (!cancelled) {
          const seen = new Set<string>();
          setRows(list.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)))
            .sort((a, b) => a.label.localeCompare(b.label)));
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  const technicians = useMemo(() => rows.map((r) => r.label), [rows]);
  /** email (minúsculas) -> nome apresentável, para dados antigos guardados com email */
  const byEmail = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.email) m.set(r.email.toLowerCase(), r.label); });
    return m;
  }, [rows]);

  return { technicians, rows, byEmail, loading };
}
