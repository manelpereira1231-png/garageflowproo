import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Loader2, Plug, RefreshCw, ShieldCheck } from "lucide-react";

type Status = {
  connected: boolean;
  account_name?: string | null;
  documento_default?: string | null;
  last_test_ok_at?: string | null;
  last_error?: string | null;
  error?: string;
};

const PAID_STATES = ["paid", "confirmed", "preparing", "shipped", "partial", "delivered"];

export default function SupplierInvoices() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ account_name: "", api_key: "", serie_default: "", documento_default: "invoice_receipt" });
  const [saving, setSaving] = useState(false);
  const [emitting, setEmitting] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gsn-supplier-invoicing", { body: { action: "status" } });
    setStatus(error ? { connected: false, error: error.message } : (data as Status));
    setLoading(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!supplierId) return;
    const [inv, ord] = await Promise.all([
      supabase.from("gsn_invoices" as any)
        .select("id,number,total,currency,pdf_url,created_at,order_id,status,provider,last_error")
        .eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(200),
      supabase.from("gsn_orders" as any)
        .select("id,order_number,total,currency,status,created_at")
        .eq("supplier_id", supplierId).in("status", PAID_STATES)
        .order("created_at", { ascending: false }).limit(100),
    ]);
    setRows(((inv.data as any) ?? []));
    setOrders(((ord.data as any) ?? []));
  }, [supplierId]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => { void loadData(); }, [loadData]);

  const issuedOrderIds = new Set(rows.filter((r) => r.status === "issued").map((r) => r.order_id));
  const pending = orders.filter((o) => !issuedOrderIds.has(o.id));

  const connect = async () => {
    if (!form.account_name.trim() || !form.api_key.trim()) return toast.error("Preencha o nome da conta e a chave API");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("gsn-supplier-invoicing", {
      body: { action: "connect", ...form },
    });
    setSaving(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || "Não foi possível ligar");
    toast.success("InvoiceXpress ligado");
    setDialog(false);
    setForm({ ...form, api_key: "" });
    void loadStatus();
  };

  const disconnect = async () => {
    await supabase.functions.invoke("gsn-supplier-invoicing", { body: { action: "disconnect" } });
    toast.success("Ligação desativada");
    void loadStatus();
  };

  const emit = async (orderId: string) => {
    setEmitting(orderId);
    const { data, error } = await supabase.functions.invoke("gsn-supplier-invoicing", {
      body: { action: "emit", order_id: orderId },
    });
    setEmitting(null);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || "Falha ao emitir a fatura");
    toast.success(`Fatura emitida${(data as any)?.number ? `: ${(data as any).number}` : ""}`);
    void loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturação</h1>
        <p className="text-sm text-muted-foreground">Emita as faturas das suas encomendas com a sua própria conta InvoiceXpress.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Plug className="w-4 h-4" /> InvoiceXpress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> A verificar a ligação...</p>
          ) : status?.connected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1"><ShieldCheck className="w-3 h-3" /> Ligado</Badge>
                <Badge variant="outline">{status.account_name}</Badge>
              </div>
              {status.last_error && <p className="text-xs text-destructive">Último erro: {status.last_error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setDialog(true)}>Alterar credenciais</Button>
                <Button size="sm" variant="outline" onClick={() => void loadStatus()}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
                <Button size="sm" variant="ghost" onClick={() => void disconnect()}>Desligar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="outline">Ainda não ligado</Badge>
              <p className="text-sm text-muted-foreground">Ligue a sua conta InvoiceXpress para emitir faturas reais das encomendas pagas.</p>
              {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
              <Button onClick={() => setDialog(true)}>Ligar InvoiceXpress</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Por faturar ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem encomendas pagas à espera de fatura.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.order_number ?? `#${o.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yyyy")} · {o.status}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-semibold">{o.currency} {Number(o.total).toFixed(2)}</p>
                    <Button size="sm" disabled={!status?.connected || emitting === o.id} onClick={() => void emit(o.id)}>
                      {emitting === o.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                      Emitir fatura
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Emitidas ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem faturas.</p> : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.number ?? `#${r.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                    {r.last_error && <p className="text-xs text-destructive truncate">{r.last_error}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-semibold">{r.currency} {Number(r.total).toFixed(2)}</p>
                    {r.pdf_url && <Button asChild size="sm" variant="outline"><a href={r.pdf_url} target="_blank" rel="noreferrer">PDF</a></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ligar a sua conta InvoiceXpress</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da conta</Label>
              <Input placeholder="aminhaempresa" value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">O subdomínio em aminhaempresa.app.invoicexpress.com</p>
            </div>
            <div>
              <Label>Chave API</Label>
              <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de documento</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={form.documento_default}
                onChange={(e) => setForm({ ...form, documento_default: e.target.value })}>
                <option value="invoice_receipt">Fatura-recibo</option>
                <option value="invoice">Fatura</option>
                <option value="simplified_invoice">Fatura simplificada</option>
              </select>
            </div>
            <div>
              <Label>Série (opcional)</Label>
              <Input value={form.serie_default} onChange={(e) => setForm({ ...form, serie_default: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={() => void connect()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ligar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
