import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  shop_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  requested_at: string;
  reviewed_at: string | null;
  shop_name?: string | null;
  shop_email?: string | null;
  shop_phone?: string | null;
  shop_nif?: string | null;
}

export default function AdminMarketActivations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: reqs } = await supabase
      .from("marketplace_activation_requests" as any)
      .select("*")
      .order("requested_at", { ascending: false });
    const list = (reqs || []) as any[];
    const shopIds = Array.from(new Set(list.map(r => r.shop_id)));
    let shopMap: Record<string, any> = {};
    if (shopIds.length) {
      const { data: shops } = await supabase.from("shops").select("id,name,email,phone,nif").in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s; });
    }
    setRows(list.map(r => ({
      ...r,
      shop_name: shopMap[r.shop_id]?.name,
      shop_email: shopMap[r.shop_id]?.email,
      shop_phone: shopMap[r.shop_id]?.phone,
      shop_nif: shopMap[r.shop_id]?.nif,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (id: string, approve: boolean) => {
    setWorking(id);
    try {
      const { data, error } = await supabase.rpc("review_marketplace_activation" as any, {
        _request_id: id, _approve: approve, _notes: notes[id] || null,
      });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast.success(approve ? "Adesão aprovada." : "Pedido recusado.");
        await load();
      } else {
        toast.error((data as any)?.error || "Erro");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao rever pedido.");
    } finally { setWorking(null); }
  };

  const filtered = rows.filter(r => tab === "pending" ? r.status === "pending" : r.status !== "pending");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-5 h-5" />
        <h1 className="text-2xl font-bold">Adesões ao Marketplace</h1>
      </div>
      <p className="text-sm text-muted-foreground">Aprove ou recuse pedidos de oficinas para participar no Marketplace (inspecções e vendas).</p>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("pending")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab==="pending" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >Pendentes ({rows.filter(r=>r.status==="pending").length})</button>
        <button
          onClick={() => setTab("reviewed")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab==="reviewed" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >Revistos ({rows.filter(r=>r.status!=="pending").length})</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sem pedidos.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {r.shop_name || "(oficina sem nome)"}
                  {r.status === "pending" && <Badge variant="outline" className="border-amber-500/50 text-amber-600">Pendente</Badge>}
                  {r.status === "approved" && <Badge variant="outline" className="border-green-500/50 text-green-600 gap-1"><CheckCircle2 className="w-3 h-3" /> Aprovado</Badge>}
                  {r.status === "rejected" && <Badge variant="outline" className="border-destructive/50 text-destructive gap-1"><XCircle className="w-3 h-3" /> Recusado</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
                  <div><span className="text-foreground">Email:</span> {r.shop_email || "—"}</div>
                  <div><span className="text-foreground">Telefone:</span> {r.shop_phone || "—"}</div>
                  <div><span className="text-foreground">NIF:</span> {r.shop_nif || "—"}</div>
                  <div><span className="text-foreground">Pedido:</span> {new Date(r.requested_at).toLocaleString("pt-PT")}</div>
                </div>
                {r.status === "pending" ? (
                  <>
                    <Textarea
                      placeholder="Notas internas / motivo (opcional)"
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(r.id, true)} disabled={working === r.id}>
                        {working === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                        Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => review(r.id, false)} disabled={working === r.id}>
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Recusar
                      </Button>
                    </div>
                  </>
                ) : (
                  r.notes && <div className="text-xs text-muted-foreground border-l-2 border-muted pl-3">Notas: {r.notes}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
