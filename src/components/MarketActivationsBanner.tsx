import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, ChevronRight, CheckCircle2, XCircle, Loader2, Phone, Mail } from "lucide-react";

type Req = {
  id: string;
  shop_id: string;
  user_id: string;
  status: string;
  requested_at: string;
  shop?: { name: string | null; email: string | null; phone: string | null; nif: string | null };
};

export function MarketActivationsBanner({ target = "/admin/market-activations" }: { target?: string }) {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    const { data: reqs } = await supabase
      .from("marketplace_activation_requests" as any)
      .select("id,shop_id,user_id,status,requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(5);
    const list = (reqs || []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.shop_id)));
    let shopMap: Record<string, any> = {};
    if (ids.length) {
      const { data: shops } = await supabase
        .from("shops")
        .select("id,name,email,phone,nif")
        .in("id", ids);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s; });
    }
    setRows(list.map((r) => ({ ...r, shop: shopMap[r.shop_id] })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("market-activations-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_activation_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const review = async (id: string, approve: boolean) => {
    setWorking(id);
    try {
      const { data, error } = await supabase.rpc("review_marketplace_activation" as any, {
        _request_id: id, _approve: approve, _notes: null,
      });
      if (error) throw error;
      if ((data as any)?.ok) toast.success(approve ? "Adesão aprovada." : "Pedido recusado.");
      else toast.error((data as any)?.error || "Erro");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao rever pedido.");
    } finally { setWorking(null); }
  };

  if (loading || rows.length === 0) return null;

  return (
    <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 shadow-lg animate-in fade-in slide-in-from-top-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center shadow-md">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center animate-pulse">
              {rows.length}
            </span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">Adesões ao Marketplace pendentes</h3>
            <p className="text-sm text-muted-foreground">
              {rows.length} oficina{rows.length > 1 ? "s" : ""} à espera de aprovação
            </p>
          </div>
        </div>
        <Button asChild size="lg" variant="outline">
          <Link to={target}>Abrir painel <ChevronRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>

      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-lg border bg-background/70 p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{r.shop?.name || "(sem nome)"}</span>
                <Badge variant="destructive" className="text-[10px]">PENDENTE</Badge>
                {r.shop?.nif && <span className="text-xs text-muted-foreground">NIF: {r.shop.nif}</span>}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {r.shop?.owner_name && <span>{r.shop.owner_name}</span>}
                {r.shop?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.shop.email}</span>}
                {r.shop?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.shop.phone}</span>}
                <span>· {new Date(r.requested_at).toLocaleString("pt-PT")}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => review(r.id, true)} disabled={working === r.id}>
                {working === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Aprovar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => review(r.id, false)} disabled={working === r.id}>
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default MarketActivationsBanner;
