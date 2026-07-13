import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarClock, Check, Clock, FileCheck2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Appt = {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  service_type: string | null;
  date: string;
  time: string;
  source: string | null;
  notes: string | null;
};

type ApprovedQuote = {
  id: string;
  number: string;
  total: number;
  status: string;
  client_name: string | null;
  updated_at: string;
  work_order_id?: string | null;
};

const DISMISS_KEY = "gf_dismissed_quote_approvals";
const getDismissed = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); } catch { return new Set(); }
};
const saveDismissed = (s: Set<string>) => {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...s].slice(-200))); } catch {}
};

export default function AppointmentsBell() {
  const { activeShopId, shops } = useShopContext();
  const ids = activeShopId ? [activeShopId] : (shops || []).map((s) => s.id);
  const [items, setItems] = useState<Appt[]>([]);
  const [marketInspections, setMarketInspections] = useState<number>(0);
  const [marketOffers, setMarketOffers] = useState<number>(0);
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedQuote[]>([]);
  const [open, setOpen] = useState(false);
  const seenApprovalsRef = useRef<Set<string>>(new Set());


  const load = useCallback(async () => {
    if (!ids.length) return;
    const dismissed = getDismissed();
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const [appts, insp, listings, quotes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id,client_name,client_phone,service_type,date,time,source,notes")
        .in("shop_id", ids)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("carity_inspection_offers")
        .select("id", { count: "exact", head: true })
        .in("shop_id", ids)
        .eq("status", "offered"),
      supabase.from("carity_listings").select("id").in("shop_id", ids),
      supabase
        .from("quotes")
        .select("id, number, total, status, updated_at, clients(name)")
        .in("shop_id", ids)
        .in("status", ["approved", "converted"])
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);
    setItems((appts.data as any) ?? []);
    setMarketInspections(insp.count || 0);

    const listingIds = (listings.data || []).map((l: any) => l.id);
    if (listingIds.length) {
      const { count } = await supabase
        .from("carity_offers" as any)
        .select("id", { count: "exact", head: true })
        .in("listing_id", listingIds)
        .eq("status", "pending");
      setMarketOffers(count || 0);
    } else {
      setMarketOffers(0);
    }

    const quoteRows = (quotes.data as any[] | null) ?? [];
    const filtered: ApprovedQuote[] = quoteRows
      .filter((q) => !dismissed.has(q.id))
      .map((q) => ({
        id: q.id,
        number: q.number,
        total: Number(q.total || 0),
        status: q.status,
        client_name: q.clients?.name ?? null,
        updated_at: q.updated_at,
      }));

    // Fire toast for freshly-approved quotes we hadn't seen yet in this session
    const knownIds = seenApprovalsRef.current;
    if (knownIds.size > 0) {
      for (const q of filtered) {
        if (!knownIds.has(q.id)) {
          toast.success(`Orçamento ${q.number} aprovado por ${q.client_name || "cliente"}`, {
            description: `Valor: €${q.total.toFixed(2)} · toque no sino para ver`,
            duration: 8000,
          });
        }
      }
    }
    seenApprovalsRef.current = new Set(filtered.map((q) => q.id));
    setApprovedQuotes(filtered);
  }, [ids.join(",")]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ids.length) return;
    const ch = supabase
      .channel("workshop-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "carity_inspection_offers" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "carity_offers" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quotes" }, (payload: any) => {
        const s = payload?.new?.status;
        if (s === "approved" || s === "converted") load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ids.join(","), load]);

  const accept = async (id: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" } as any)
      .eq("id", id);
    if (error) return toast.error("Erro a confirmar");
    toast.success("Marcação confirmada");
    setItems((prev) => prev.filter((a) => a.id !== id));
  };

  const dismissQuote = (id: string) => {
    const s = getDismissed(); s.add(id); saveDismissed(s);
    setApprovedQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  const count = items.length + marketInspections + marketOffers + approvedQuotes.length;


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors mr-1 group"
          aria-label={`${count} marcações pendentes`}
          title="Marcações pendentes"
        >
          <CalendarClock className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-background animate-pulse">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[70vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Marcações pendentes</div>
            <div className="text-xs text-muted-foreground">A aguardar aceitação</div>
          </div>
          <Link to="/agenda" className="text-xs text-amber-500 hover:underline" onClick={() => setOpen(false)}>
            Ver agenda
          </Link>
        </div>
        {count === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Sem notificações
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {approvedQuotes.length > 0 && (
              <div className="p-3 bg-emerald-500/5">
                <div className="text-xs font-semibold text-emerald-500 mb-2 flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5" /> Orçamentos aprovados pelo cliente
                </div>
                {approvedQuotes.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {q.number} · {q.client_name || "Cliente"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        €{q.total.toFixed(2)} · {new Date(q.updated_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setOpen(false); dismissQuote(q.id); }}>
                        <Link to="/services">Ver</Link>
                      </Button>
                      <button
                        aria-label="Dispensar"
                        onClick={() => dismissQuote(q.id)}
                        className="text-muted-foreground hover:text-foreground text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(marketInspections > 0 || marketOffers > 0) && (
              <div className="p-3 bg-amber-500/5">
                <div className="text-xs font-semibold text-amber-500 mb-2">GarageFlow Market</div>
                {marketInspections > 0 && (
                  <Link to="/market/inspections" onClick={() => setOpen(false)} className="flex items-center justify-between py-1.5 hover:bg-muted/40 rounded px-2 -mx-2 text-sm">
                    <span>{marketInspections} pedido(s) de inspeção</span>
                    <span className="text-xs text-muted-foreground">Ver →</span>
                  </Link>
                )}
                {marketOffers > 0 && (
                  <Link to="/market/offers" onClick={() => setOpen(false)} className="flex items-center justify-between py-1.5 hover:bg-muted/40 rounded px-2 -mx-2 text-sm">
                    <span>{marketOffers} oferta(s) recebida(s)</span>
                    <span className="text-xs text-muted-foreground">Ver →</span>
                  </Link>
                )}
              </div>
            )}
            {items.map((a) => (
              <div key={a.id} className="p-3 hover:bg-muted/40">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{a.client_name || "Cliente"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.service_type || "Serviço"} · {a.date} {a.time?.slice(0, 5)}
                    </div>
                    {a.client_phone && (
                      <div className="text-xs text-muted-foreground">{a.client_phone}</div>
                    )}
                  </div>
                  {a.source && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {a.source}
                    </span>
                  )}
                </div>
                {a.notes && <div className="text-xs text-muted-foreground mb-2 line-clamp-2">{a.notes}</div>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="h-8 flex-1" onClick={() => accept(a.id)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Aceitar
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1"
                    onClick={() => setOpen(false)}
                  >
                    <Link to="/agenda"><Clock className="w-3.5 h-3.5 mr-1" /> Reagendar</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
