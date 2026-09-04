import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminNotification = {
  id: string;
  kind: "shop_signup" | "payment" | "subscription";
  title: string;
  description: string;
  at: string;
  link: string;
};

function fmtMoney(value: number | null, currency: string | null) {
  const v = Number(value || 0);
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: currency || "EUR" }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency || "EUR"}`;
  }
}

/** Notifica todas as instâncias montadas do hook que houve alteração de leituras. */
function broadcastRead() {
  window.dispatchEvent(new Event("gf-admin-notifs-read"));
}

/** Marca uma notificação como lida (persistido na base de dados). */
export async function markAdminNotifRead(notificationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("admin_notification_reads")
    .upsert({ user_id: user.id, notification_id: notificationId }, { onConflict: "user_id,notification_id" });
  broadcastRead();
}

/** Marca várias notificações como lidas de uma só vez. */
export async function markAdminNotifsRead(ids: string[]) {
  if (!ids.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("admin_notification_reads")
    .upsert(ids.map((notification_id) => ({ user_id: user.id, notification_id })), { onConflict: "user_id,notification_id" });
  broadcastRead();
}

export function useAdminNotifications(limit = 40) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const loadReads = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("admin_notification_reads")
      .select("notification_id")
      .eq("user_id", user.id);
    if (mounted.current) setReadIds(new Set((data || []).map((r: any) => r.notification_id)));
  }, []);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Oficinas de demonstração (is_demo) nunca contam como oficinas reais.
    const [shopsRes, paymentsRes, subsRes] = await Promise.all([
      supabase.from("shops").select("id, name, email, created_at").eq("is_demo", false).gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
      supabase.from("payments").select("id, shop_id, amount, paid_at, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
      supabase.from("subscriptions").select("id, shop_id, plan, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    ]);

    const shopIds = new Set<string>();
    (paymentsRes.data || []).forEach((p: any) => p.shop_id && shopIds.add(p.shop_id));
    (subsRes.data || []).forEach((s: any) => s.shop_id && shopIds.add(s.shop_id));

    const shopNames: Record<string, string> = {};
    const demoShops = new Set<string>();
    (shopsRes.data || []).forEach((s: any) => { shopNames[s.id] = s.name; });
    const missing = [...shopIds].filter((id) => !shopNames[id]);
    if (missing.length) {
      const { data } = await supabase.from("shops").select("id, name, is_demo").in("id", missing);
      (data || []).forEach((s: any) => {
        if (s.is_demo) demoShops.add(s.id);
        else shopNames[s.id] = s.name;
      });
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
      if (p.shop_id && demoShops.has(p.shop_id)) return;
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
      if (s.shop_id && demoShops.has(s.shop_id)) return;
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
    if (!mounted.current) return;
    setItems(list.slice(0, limit));
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    mounted.current = true;
    load();
    loadReads();

    const channel = supabase
      .channel("admin-notifications-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shops" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "subscriptions" }, () => load())
      .subscribe();

    const onRead = () => loadReads();
    window.addEventListener("gf-admin-notifs-read", onRead);
    const interval = window.setInterval(load, 60_000);

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
      window.removeEventListener("gf-admin-notifs-read", onRead);
      window.clearInterval(interval);
    };
  }, [load, loadReads]);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);
  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  const markRead = useCallback(async (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    await markAdminNotifRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = items.map((i) => i.id);
    setReadIds(new Set(ids));
    await markAdminNotifsRead(ids);
  }, [items]);

  return { items, loading, unreadCount, isRead, markRead, markAllRead, reload: load };
}
