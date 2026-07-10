import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Phone, Mail, ChevronRight } from "lucide-react";

type DemoReq = {
  id: string;
  name: string;
  shop_name: string;
  email: string;
  phone: string;
  city: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: "destructive" | "secondary" | "default" | "outline" }> = {
  new: { label: "NOVO", variant: "destructive" },
  contacted: { label: "Em contacto", variant: "secondary" },
  scheduled: { label: "Agendado", variant: "default" },
  done: { label: "Realizado", variant: "outline" },
  converted: { label: "Convertido", variant: "outline" },
};

export function DemoRequestsBanner({ target = "/commercial/demos" }: { target?: "/commercial/demos" | "/admin/demos" }) {
  const [items, setItems] = useState<DemoReq[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("demo_requests" as any)
      .select("id,name,shop_name,email,phone,city,status,scheduled_at,created_at,archived_at")
      .is("archived_at", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(5);
    setItems(((data as any[]) ?? []) as DemoReq[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("demo-requests-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const newCount = useMemo(() => items.filter((i) => i.status === "new").length, [items]);

  if (loading || items.length === 0) return null;

  return (
    <Card className="border-2 border-amber-500/60 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5 sm:p-6 shadow-lg animate-in fade-in slide-in-from-top-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-11 w-11 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
              <Bell className="h-5 w-5 text-white" />
            </div>
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center animate-pulse">
                {newCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">Pedidos de Demonstração pendentes</h3>
            <p className="text-sm text-muted-foreground">
              {newCount > 0
                ? `${newCount} novo${newCount > 1 ? "s" : ""} pedido${newCount > 1 ? "s" : ""} à espera de contacto`
                : `${items.length} em acompanhamento`}
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="bg-amber-600 hover:bg-amber-700 text-white">
          <Link to={target}>
            Abrir Painel de Demonstrações
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-2">
        {items.slice(0, 3).map((r) => (
          <Link
            key={r.id}
            to={target}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border bg-background/70 hover:bg-background p-3 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{r.shop_name}</span>
                <Badge variant={STATUS_LABEL[r.status]?.variant ?? "secondary"} className="text-[10px]">
                  {STATUS_LABEL[r.status]?.label ?? r.status}
                </Badge>
                {r.city && <span className="text-xs text-muted-foreground">• {r.city}</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.name} — recebido {new Date(r.created_at).toLocaleString("pt-PT")}
                {r.scheduled_at && <> · 📅 {new Date(r.scheduled_at).toLocaleString("pt-PT")}</>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>
              <span className="hidden sm:flex items-center gap-1 truncate max-w-[200px]"><Mail className="h-3 w-3" />{r.email}</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default DemoRequestsBanner;
