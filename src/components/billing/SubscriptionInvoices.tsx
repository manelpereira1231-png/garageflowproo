/**
 * Faturas da subscrição GarageFlow (GarageFlow → oficina).
 *
 * NÃO confundir com as faturas que a oficina emite aos seus clientes
 * (essas vivem em /invoices e continuam intocadas).
 *
 * Lê `platform_invoices` — a RLS garante que cada oficina só vê as suas.
 * Enquanto a faturação fiscal do GarageFlow não estiver ativa, mostramos o
 * pagamento (Stripe) mas nunca um documento fiscal fictício.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink } from "lucide-react";

interface Row {
  id: string;
  plan: string | null;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  amount_net: number;
  vat_amount: number;
  amount_total: number;
  fiscal_status: string;
  provider_number: string | null;
  provider_pdf_url: string | null;
  stripe_hosted_url: string | null;
  paid_at: string | null;
  created_at: string;
}

const money = (v: number, c: string) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: c || "EUR" }).format(Number(v || 0));

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-PT") : "—");

export default function SubscriptionInvoices() {
  const shopId = useActiveShopId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("platform_invoices")
        .select("id, plan, period_start, period_end, currency, amount_net, vat_amount, amount_total, fiscal_status, provider_number, provider_pdf_url, stripe_hosted_url, paid_at, created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  if (loading) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">Faturas da subscrição</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Documentos da tua subscrição GarageFlow. As faturas que emites aos teus clientes estão em Faturação.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Ainda não existem faturas fiscais disponíveis.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">Documento</th>
                <th className="text-left py-2 px-2">Data</th>
                <th className="text-left py-2 px-2">Período</th>
                <th className="text-left py-2 px-2">Plano</th>
                <th className="text-right py-2 px-2">Sem IVA</th>
                <th className="text-right py-2 px-2">IVA</th>
                <th className="text-right py-2 px-2">Total</th>
                <th className="text-left py-2 px-2">Estado</th>
                <th className="text-right py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 px-2 font-medium">
                    {r.provider_number ?? <span className="text-muted-foreground">Por emitir</span>}
                  </td>
                  <td className="py-2 px-2">{fmt(r.paid_at ?? r.created_at)}</td>
                  <td className="py-2 px-2 text-muted-foreground">
                    {r.period_start ? `${fmt(r.period_start)} – ${fmt(r.period_end)}` : "—"}
                  </td>
                  <td className="py-2 px-2 capitalize">{r.plan ?? "—"}</td>
                  <td className="py-2 px-2 text-right">{money(r.amount_net, r.currency)}</td>
                  <td className="py-2 px-2 text-right">{money(r.vat_amount, r.currency)}</td>
                  <td className="py-2 px-2 text-right font-semibold">{money(r.amount_total, r.currency)}</td>
                  <td className="py-2 px-2">
                    {r.fiscal_status === "issued" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-0">Pago · Fatura emitida</Badge>
                    ) : r.fiscal_status === "error" ? (
                      <Badge variant="destructive">Pago · fatura com erro</Badge>
                    ) : r.fiscal_status === "cancelled" ? (
                      <Badge variant="outline">Anulada</Badge>
                    ) : (
                      <Badge variant="secondary">Pago · fatura por emitir</Badge>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {r.provider_pdf_url ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={r.provider_pdf_url} target="_blank" rel="noreferrer">
                          <Download className="w-3.5 h-3.5 mr-1" /> PDF
                        </a>
                      </Button>
                    ) : r.stripe_hosted_url ? (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={r.stripe_hosted_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Recibo do pagamento
                        </a>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
