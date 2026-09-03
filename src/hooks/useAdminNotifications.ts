import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminNotification = {
  id: string;
  kind: "shop_signup" | "payment" | "subscription";
  title: string;
  description: string;
  at: string;
  link: string;
};

const READ_KEY = "gf_admin_notifs_read_at";

export function getAdminNotifsReadAt(): string {
  return localStorage.getItem(READ_KEY) || "1970-01-01T00:00:00.000Z";
}

export function markAdminNotifsRead() {
  localStorage.setItem(READ_KEY, new Date().toISOString());
  window.dispatchEvent(new Event("gf-admin-notifs-read"));
}

function fmtMoney(value: number | null, currency: string | null) {
  const v = Number(value || 0);
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: currency || "EUR" }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency || "EUR"}`;
  }
}

export function useAdminNotifications(limit = 40) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readAt, setReadAt] = useState<string>(getAdminNotifsReadAt());

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [shopsRes, paymentsRes, subsRes] = await Promise.all([
      supabase.from("shops").select("id, name, email, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
      supabase.from("payments").select("id, shop_id, amount, paid_at, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
      supabase.from("subscriptions").select("id, shop_id, plan, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    ]);

    const shopIds = new Set<string>();
    (paymentsRes.data || []).forEach((p: any) => p.shop_id && shopIds.add(p.shop_id));
    (subsRes.data || []).forEach((s: any) => s.shop_id && shopIds.add(s.shop_id));

    let shopNames: Record<string, string> = {};
    (shopsRes.data || []).forEach((s: any) => { shopNames[s.id] = s.name; });
    const missing = [...shopIds].filter((id) => !shopNames[id]);
    if (missing.length) {
      const { data } = await supabase.from("shops").select("id, name").in("id", missing);
      (data || []).forEach((s: any) => { shopNames[s.id] = s.name; });
    }

    const list: AdminNotification[] = [];

    (shopsRes.data || []).forEach((s: any) => {
      list.push({
        id: `shop:${s.id}`,
        kind: "shop_signup",
        title: "Nova oficina registada",
        description: `${s.name || "Sem nome"}${s.email ? ` · ${s.email}` : ""}`,
        at: s.created_at,
        link: `/admin/shops/${s.id}`,
      });
    });

    (paymentsRes.data || []).forEach((p: any) => {
      list.push({
        id: `pay:${p.id}`,
        kind: "payment",
        title: "Pagamento recebido",
        description: `${shopNames[p.shop_id] || "Oficina"} · ${fmtMoney(p.amount, null)}`,
        at: p.paid_at || p.created_at,
        link: p.shop_id ? `/admin/shops/${p.shop_id}` : "/admin/billing",
      });
    });

    (subsRes.data || []).forEach((s: any) => {
      list.push({
        id: `sub:${s.id}`,
        kind: "subscription",
        title: "Nova subscrição",
        description: `${shopNames[s.shop_id] || "Oficina"} · plano ${s.plan || "—"}${s.status ? ` (${s.status})` : ""}`,
        at: s.created_at,
        link: s.shop_id ? `/admin/shops/${s.shop_id}` : "/admin/billing",
      });
    });

    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(list.slice(0, limit));
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-notifications-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shops" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "subscriptions" }, () => load())
      .subscribe();

    const onRead = () => setReadAt(getAdminNotifsReadAt());
    window.addEventListener("gf-admin-notifs-read", onRead);
    const interval = window.setInterval(load, 60_000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("gf-admin-notifs-read", onRead);
      window.clearInterval(interval);
    };
  }, [load]);

  const unreadCount = items.filter((i) => new Date(i.at).getTime() > new Date(readAt).getTime()).length;

  return { items, loading, unreadCount, readAt, reload: load };
}
