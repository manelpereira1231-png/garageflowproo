/**
 * Notificações internas do módulo GSN.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface GsnNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useGsnNotifications() {
  const { user } = useAuthReady();
  const [items, setItems] = useState<GsnNotification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("gsn_notifications" as any)
      .select("id,kind,title,body,link,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as any) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const ch = supabase.channel(`gsn-notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gsn_notifications", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("gsn_notifications" as any).update({ read: true }).eq("id", id);
    void load();
  }, [load]);

  const unread = items.filter((n) => !n.read).length;
  return { items, unread, markRead, reload: load };
}
