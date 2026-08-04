import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Percent } from "lucide-react";

interface CommissionRow {
  id: string;
  invoice_number: string | null;
  shop_id: string;
  gross_amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  currency: string;
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
 * Comissões retidas automaticamente pelo Stripe (application_fee) em pagamentos
 * recebidos diretamente nas contas Stripe Connect das oficinas.
 */
export default function PlatformCommissionsReport() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_commissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      const list = (data || []) as unknown as CommissionRow[];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.shop_id))];
      if (ids.length) {
        const { data: sh } = await supabase.from("shops").select("id, name").in("id", ids);
        setShops(Object.fromEntries((sh || []).map((s: any) => [s.id, s.name])));
      }
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="w-4 h-4" /> Comissões retidas via Stripe Connect
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há pagamentos recebidos em contas Stripe Connect de oficinas.
          </p>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium">{shops[r.shop_id] || r.shop_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">Fatura {r.invoice_number || "—"}</div>
                  <div className="mt-1 flex justify-between">
                    <span>Bruto</span><span>{money(r.gross_amount, r.currency)}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>Comissão ({r.fee_percent}%)</span><span>{money(r.fee_amount, r.currency)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Oficina</span><span>{money(r.net_amount, r.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Data</th>
                    <th>Oficina</th>
                    <th>Fatura</th>
                    <th className="text-right">Bruto</th>
                    <th className="text-right">Comissão</th>
                    <th className="text-right">Oficina recebe</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>{shops[r.shop_id] || r.shop_id.slice(0, 8)}</td>
                      <td>{r.invoice_number || "—"}</td>
                      <td className="text-right">{money(r.gross_amount, r.currency)}</td>
                      <td className="text-right text-primary">
                        {money(r.fee_amount, r.currency)} <span className="text-xs">({r.fee_percent}%)</span>
                      </td>
                      <td className="text-right">{money(r.net_amount, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
