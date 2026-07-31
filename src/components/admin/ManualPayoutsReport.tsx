import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Banknote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface PayoutRow {
  id: string;
  invoice_id: string;
  shop_id: string;
  invoice_number: string | null;
  gross_amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  transferred_at: string | null;
  created_at: string;
}

function money(v: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(v || 0);
  } catch {
    return `${(v || 0).toFixed(2)} ${currency}`;
  }
}

/**
 * Repasses manuais: faturas pagas na conta Stripe da plataforma (oficina sem
 * Stripe Connect). Mostra valor recebido, comissão retida e líquido a transferir.
 */
export default function ManualPayoutsReport() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manual_payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(error.message);
    const list = (data || []) as PayoutRow[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.shop_id))];
    if (ids.length) {
      const { data: sh } = await supabase.from("shops").select("id, name").in("id", ids);
      setShops(Object.fromEntries((sh || []).map((s: any) => [s.id, s.name])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    return {
      gross: rows.reduce((a, r) => a + Number(r.gross_amount || 0), 0),
      fee: rows.reduce((a, r) => a + Number(r.fee_amount || 0), 0),
      pendingNet: pending.reduce((a, r) => a + Number(r.net_amount || 0), 0),
      currency: rows[0]?.currency || "EUR",
      pendingCount: pending.length,
    };
  }, [rows]);

  const markTransferred = async (row: PayoutRow) => {
    setBusy(row.id);
    const { error } = await supabase
      .from("manual_payouts")
      .update({ status: "transferred", transferred_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Repasse marcado como transferido.");
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="w-4 h-4" /> Repasses manuais (sem Stripe Connect)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Faturas pagas através da conta da plataforma. A comissão é retida por si; o líquido tem de
          ser transferido manualmente para a oficina.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há pagamentos recebidos na conta da plataforma.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total recebido</p>
                <p className="text-lg font-semibold">{money(totals.gross, totals.currency)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Comissão retida</p>
                <p className="text-lg font-semibold">{money(totals.fee, totals.currency)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Por transferir ({totals.pendingCount})
                </p>
                <p className="text-lg font-semibold">{money(totals.pendingNet, totals.currency)}</p>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2">Fatura</th>
                    <th>Oficina</th>
                    <th className="text-right">Recebido</th>
                    <th className="text-right">Comissão</th>
                    <th className="text-right">Líquido</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2">{r.invoice_number || r.invoice_id.slice(0, 8)}</td>
                      <td>{shops[r.shop_id] || "—"}</td>
                      <td className="text-right">{money(Number(r.gross_amount), r.currency)}</td>
                      <td className="text-right">
                        {money(Number(r.fee_amount), r.currency)}{" "}
                        <span className="text-xs text-muted-foreground">({r.fee_percent}%)</span>
                      </td>
                      <td className="text-right font-medium">{money(Number(r.net_amount), r.currency)}</td>
                      <td>
                        <Badge variant={r.status === "transferred" ? "secondary" : "outline"}>
                          {r.status === "transferred" ? "Transferido" : "Pendente"}
                        </Badge>
                      </td>
                      <td className="text-right">
                        {r.status !== "transferred" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === r.id}
                            onClick={() => markTransferred(r)}
                          >
                            {busy === r.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            <span className="ml-1">Marcar transferido</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.invoice_number || r.invoice_id.slice(0, 8)}</span>
                    <Badge variant={r.status === "transferred" ? "secondary" : "outline"}>
                      {r.status === "transferred" ? "Transferido" : "Pendente"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{shops[r.shop_id] || "—"}</p>
                  <p className="text-sm">
                    Recebido {money(Number(r.gross_amount), r.currency)} · Comissão{" "}
                    {money(Number(r.fee_amount), r.currency)} ({r.fee_percent}%)
                  </p>
                  <p className="text-sm font-semibold">
                    Líquido: {money(Number(r.net_amount), r.currency)}
                  </p>
                  {r.status !== "transferred" && (
                    <Button
                      className="w-full min-h-[44px]"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => markTransferred(r)}
                    >
                      {busy === r.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Marcar transferido
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
