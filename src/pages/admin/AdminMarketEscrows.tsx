import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Action = "admin_release" | "admin_refund";

export default function AdminMarketEscrows() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ row: any; action: Action } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("market_escrow")
      .select("id, listing_id, buyer_id, seller_id, amount, platform_fee, status, created_at, disputed_at, released_at, refunded_at, capture_method, stripe_verified, buyer_dispute_reason, seller_dispute_response")
      .order("created_at", { ascending: false })
      .limit(300);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const STATUSES = ["all", "pending", "paid", "delivery_confirmed", "released", "disputed", "refunded", "cancelled"];

  const totals = rows.reduce(
    (acc, r) => {
      acc.volume += Number(r.amount || 0);
      acc.fees += Number(r.platform_fee || 0);
      if (r.status === "disputed") acc.disputes++;
      return acc;
    },
    { volume: 0, fees: 0, disputes: 0 }
  );

  const canAct = (s: string) => ["paid", "delivery_confirmed", "disputed"].includes(s);

  const runAction = async () => {
    if (!dialog) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("market-escrow-manage", {
      body: { action: dialog.action, escrow_id: dialog.row.id, resolution_notes: notes || undefined },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Falha na operação");
      return;
    }
    toast.success((data as any)?.message || "Operação concluída");
    setDialog(null);
    setNotes("");
    load();
  };

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-amber-500" /> Market — Escrow & Disputas</h1>
        <p className="text-sm text-muted-foreground">Transações em garantia, libertações e disputas.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Volume listado</p>
          <p className="text-xl font-bold">€{totals.volume.toLocaleString("pt-PT")}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Comissões</p>
          <p className="text-xl font-bold text-amber-600">€{totals.fees.toLocaleString("pt-PT")}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Disputas</p>
          <p className="text-xl font-bold text-red-600 flex items-center gap-1">
            {totals.disputes > 0 && <AlertTriangle className="w-4 h-4" />}
            {totals.disputes}
          </p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-xs px-2.5 py-1 rounded-full border ${status === s ? "bg-amber-500 text-black border-amber-500" : "border-border hover:bg-accent"}`}>
            {s === "all" ? "Todos" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {rows.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Sem transações.</div>}
              {rows.map(r => (
                <div key={r.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-mono">#{r.id.slice(0, 8)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-PT")}
                        {r.stripe_verified ? " · Stripe ✓" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">€{Number(r.amount || 0).toLocaleString("pt-PT")}</p>
                      <Badge variant={r.status === "disputed" ? "destructive" : "outline"} className="text-[10px] mt-1">{r.status}</Badge>
                    </div>
                  </div>

                  {r.status === "disputed" && r.buyer_dispute_reason && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs">
                      <p className="font-semibold text-red-700 dark:text-red-300">Motivo do comprador:</p>
                      <p className="text-red-700/90 dark:text-red-300/90">{r.buyer_dispute_reason}</p>
                      {r.seller_dispute_response && (
                        <>
                          <p className="font-semibold text-red-700 dark:text-red-300 mt-1">Resposta do vendedor:</p>
                          <p className="text-red-700/90 dark:text-red-300/90">{r.seller_dispute_response}</p>
                        </>
                      )}
                    </div>
                  )}

                  {canAct(r.status) && (
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setDialog({ row: r, action: "admin_refund" }); setNotes(""); }}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reembolsar
                      </Button>
                      <Button size="sm" onClick={() => { setDialog({ row: r, action: "admin_release" }); setNotes(""); }}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Libertar fundos
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === "admin_release" ? "Libertar fundos ao vendedor" : "Reembolsar comprador"}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escrow <span className="font-mono">#{dialog.row.id.slice(0, 8)}</span> — €{Number(dialog.row.amount || 0).toLocaleString("pt-PT")}.
                {dialog.action === "admin_refund" && " O valor será reembolsado via Stripe."}
              </p>
              <div>
                <Label>Notas de resolução (opcional)</Label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Motivo, decisão tomada, etc." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={runAction} disabled={busy} variant={dialog?.action === "admin_refund" ? "destructive" : "default"}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
