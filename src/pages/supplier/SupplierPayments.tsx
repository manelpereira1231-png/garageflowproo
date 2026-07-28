import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";

export default function SupplierPayments() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!supplierId) return;
    supabase.from("gsn_payments" as any)
      .select("id,amount,currency,status,stripe_payment_intent_id,created_at,order_id")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as any) ?? []));
  }, [supplierId]);

  const total = rows.filter(r => r.status === "succeeded" || r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos</h1>
        <p className="text-sm text-muted-foreground">Pagamentos processados via Stripe Connect.</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Total recebido</p>
          <p className="text-2xl font-bold">{formatMoney(total)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Histórico ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem pagamentos.</p> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="text-sm font-mono">{r.stripe_payment_intent_id ?? `#${r.id.slice(0,8)}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(Number(r.amount), r.currency)}</p>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
