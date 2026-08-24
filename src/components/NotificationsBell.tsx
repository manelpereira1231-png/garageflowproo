import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, FileCheck2, CreditCard, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getCountryConfig } from "@/lib/regionConfig";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

/**
 * Sino de Notificações — separado da Agenda.
 *
 * Reutiliza o sistema de notificações já existente (tabela `notifications`,
 * alimentada pelos webhooks de pagamento, aprovações de orçamento e restantes
 * eventos). Não cria nenhum sistema paralelo: apenas lê, marca como lida e
 * encaminha para o link já gravado em cada notificação.
 */
export default function NotificationsBell() {
  const { activeShopId, shops } = useShopContext();
  const ids = activeShopId ? [activeShopId] : (shops || []).map((s) => s.id);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!ids.length) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,message,link,read,created_at")
      .in("shop_id", ids)
      .is("archived_at", null)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as any) ?? []);
  }, [ids.join(",")]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ids.length) return;
    const ch = supabase
      .channel("gf-notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ids.join(","), load]);

  const markRead = async (id: string) => {
    // Sai imediatamente da lista — o sino só mostra notificações por ler
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
  };

  const markAllRead = async () => {
    const unread = items.map((n) => n.id);
    if (!unread.length) return;
    setItems([]);
    await supabase.from("notifications").update({ read: true } as any).in("id", unread);
  };

  const iconFor = (n: Notif) => {
    const txt = `${n.title} ${n.message}`.toLowerCase();
    if (txt.includes("pagament") || txt.includes("fatura")) return <CreditCard className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (txt.includes("orçament")) return <FileCheck2 className="w-4 h-4 text-amber-500 shrink-0" />;
    return <Info className="w-4 h-4 text-muted-foreground shrink-0" />;
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors mr-1 group"
          aria-label={`${unreadCount} notificações por ler`}
          title="Notificações"
        >
          <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[70vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Notificações</div>
            <div className="text-xs text-muted-foreground">Orçamentos, pagamentos e alertas</div>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Marcar lidas
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações por ler</div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((n) => {
              const body = (
                <div className="flex items-start gap-2">
                  {iconFor(n)}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${n.read ? "font-normal" : "font-semibold"}`}>{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString(getCountryConfig().locale, { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />}
                </div>
              );
              const cls = `block p-3 hover:bg-muted/40 ${n.read ? "" : "bg-amber-500/5"}`;
              return n.link ? (
                <Link key={n.id} to={n.link} className={cls} onClick={() => { setOpen(false); markRead(n.id); }}>
                  {body}
                </Link>
              ) : (
                <button key={n.id} type="button" className={`${cls} w-full text-left`} onClick={() => markRead(n.id)}>
                  {body}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
