import { useEffect, useState, useCallback } from "react";
import { CalendarClock, Check, Clock } from "lucide-react";
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

export default function AppointmentsBell() {
  const { activeShopId, shopIds } = useShopContext();
  const ids = (activeShopId ? [activeShopId] : shopIds) || [];
  const [items, setItems] = useState<Appt[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!ids.length) return;
    const { data } = await supabase
      .from("appointments")
      .select("id,client_name,client_phone,service_type,date,time,source,notes")
      .in("shop_id", ids)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as any) ?? []);
  }, [ids.join(",")]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ids.length) return;
    const ch = supabase
      .channel("appointments-bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => load()
      )
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

  const count = items.length;

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
            Sem marcações pendentes
          </div>
        ) : (
          <div className="divide-y divide-border/60">
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
