import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Bell, Search, CheckCheck, CreditCard, FileCheck2, FileX2, Info, ExternalLink, Inbox,
} from "lucide-react";
import { getCountryConfig } from "@/lib/regionConfig";
import ListSkeleton from "@/components/ListSkeleton";

type Notif = {
  id: string;
  type: string | null;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

type Filter = "pending" | "all" | "read";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Por abrir" },
  { key: "read", label: "Lidas" },
  { key: "all", label: "Todas" },
];

function kindOf(n: Notif) {
  const txt = `${n.type || ""} ${n.title} ${n.message || ""}`.toLowerCase();
  if (txt.includes("reject") || txt.includes("rejeit")) return "rejected";
  if (txt.includes("pagament") || txt.includes("payment") || txt.includes("fatura")) return "payment";
  if (txt.includes("orçament") || txt.includes("quote") || txt.includes("aprov")) return "quote";
  return "other";
}

const KIND_META: Record<string, { icon: any; color: string; label: string }> = {
  quote: { icon: FileCheck2, color: "text-warning", label: "Orçamento" },
  rejected: { icon: FileX2, color: "text-destructive", label: "Orçamento rejeitado" },
  payment: { icon: CreditCard, color: "text-success", label: "Pagamento" },
  other: { icon: Info, color: "text-info", label: "Evento" },
};

/**
 * Notificações da oficina — separador dedicado dentro de Comunicação.
 *
 * Reutiliza integralmente o sistema de notificações existente (tabela
 * `notifications`, alimentada pelos triggers de aprovação/rejeição de
 * orçamentos, webhooks de pagamento e restantes eventos). Não cria nenhum
 * sistema paralelo — apenas lê, marca como lida (persistido na base de dados)
 * e encaminha para o registo associado através do `link` já gravado.
 */
export default function Notifications() {
  const { activeShopId, shops } = useShopContext();
  const shopIds = useMemo(
    () => (activeShopId ? [activeShopId] : (shops || []).map((s) => s.id)),
    [activeShopId, shops],
  );
  const idsKey = shopIds.join(",");

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!shopIds.length) { setLoading(false); return; }
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,message,link,read,created_at")
      .in("shop_id", shopIds)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(((data as any) ?? []) as Notif[]);
    setLoading(false);
  }, [idsKey]);

  useEffect(() => { load(); }, [load]);

  // Realtime: novas notificações aparecem sem refresh manual.
  useEffect(() => {
    if (!shopIds.length) return;
    const ch = supabase
      .channel("gf-notifications-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [idsKey, load]);

  // Marca como lida na base de dados — o estado persiste após refresh e logout.
  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const { error } = await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    if (error) load();
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase.from("notifications").update({ read: true } as any).in("id", unread);
    if (error) load();
  };

  const unreadCount = items.filter((n) => !n.read).length;

  const visible = items.filter((n) => {
    if (filter === "pending" && n.read) return false;
    if (filter === "read" && !n.read) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${n.title} ${n.message || ""}`.toLowerCase().includes(q);
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(getCountryConfig().locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notificações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orçamentos aprovados e rejeitados, pagamentos recebidos e outros eventos da oficina.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="min-h-[44px] sm:min-h-0">
            <CheckCheck className="w-4 h-4 mr-2" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            className="whitespace-nowrap"
          >
            {f.label}
            {f.key === "pending" && unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">{unreadCount}</Badge>
            )}
          </Button>
        ))}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar notificações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">
            {filter === "pending" ? "Nenhuma notificação por abrir" : "Sem notificações"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            As decisões dos clientes e os pagamentos recebidos aparecem aqui automaticamente.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((n) => {
            const meta = KIND_META[kindOf(n)];
            const Icon = meta.icon;
            const inner = (
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                    {!n.read && <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Por abrir</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{meta.label}</Badge>
                  </div>
                  {n.message && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{n.message}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">{fmt(n.created_at)}</p>
                </div>
                {n.link && <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            );
            const cls = `block p-4 rounded-lg border transition-colors hover:bg-muted/40 ${
              n.read ? "border-border/60 bg-card" : "border-warning/30 bg-warning/5"
            }`;
            return n.link ? (
              <Link key={n.id} to={n.link} className={cls} onClick={() => markRead(n.id)}>
                {inner}
              </Link>
            ) : (
              <button key={n.id} type="button" className={`${cls} w-full text-left`} onClick={() => markRead(n.id)}>
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
