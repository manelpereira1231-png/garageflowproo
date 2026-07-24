import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { format } from "date-fns";

export default function SupplierInvoices() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!supplierId) return;
    supabase.from("gsn_invoices" as any)
      .select("id,number,total,currency,pdf_url,created_at,order_id")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as any) ?? []));
  }, [supplierId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturas</h1>
        <p className="text-sm text-muted-foreground">Faturas emitidas para cada encomenda.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Emitidas ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem faturas.</p> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="text-sm font-medium">{r.number ?? `#${r.id.slice(0,8)}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{r.currency} {Number(r.total).toFixed(2)}</p>
                    {r.pdf_url && <Button asChild size="sm" variant="outline"><a href={r.pdf_url} target="_blank" rel="noreferrer">PDF</a></Button>}
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
