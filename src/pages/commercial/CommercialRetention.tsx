import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, XCircle, CreditCard } from "lucide-react";
import { formatLocalDate } from "@/lib/marketPrice";

type Row = { id: string; name: string; email: string; last_seen_at?: string; status?: string };

export default function CommercialRetention() {
  const [inactive, setInactive] = useState<Row[]>([]);
  const [neverLogged, setNeverLogged] = useState<Row[]>([]);
  const [atRisk, setAtRisk] = useState<Row[]>([]);
  const [paymentPending, setPaymentPending] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [shopsRes, subsRes] = await Promise.all([
        supabase.from("shops").select("id, name, email, last_seen_at, status").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("shop_id, status"),
      ]);

      const shops = (shopsRes.data || []) as Row[];
      const subs = subsRes.data || [];
      const subStatus = new Map<string, string>();
      subs.forEach((s: any) => subStatus.set(s.shop_id, s.status));

      setInactive(shops.filter((s) => s.last_seen_at && s.last_seen_at < d30));
      setNeverLogged(shops.filter((s) => !s.last_seen_at));
      setAtRisk(shops.filter((s) => s.last_seen_at && s.last_seen_at < d7 && s.last_seen_at >= d30));
      setPaymentPending(shops.filter((s) => ["past_due", "unpaid", "incomplete"].includes(subStatus.get(s.id) || "")));
      setLoading(false);
    })();
  }, []);

  const Section = ({ title, icon: Icon, rows, tone }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Icon className={`w-4 h-4 ${tone}`} /> {title}</CardTitle>
        <Badge variant="secondary">{rows.length}</Badge>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && <div className="text-xs text-muted-foreground">Nada a reportar.</div>}
        <div className="space-y-1 max-h-[260px] overflow-y-auto">
          {rows.slice(0, 50).map((r: Row) => (
            <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <span className="truncate font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground ml-2 truncate">{r.last_seen_at ? formatLocalDate(r.last_seen_at) : 'Nunca'}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="text-sm text-muted-foreground">A analisar oficinas reais…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Centro de Retenção</h2>
        <p className="text-sm text-muted-foreground">Oficinas que precisam de atenção comercial imediata.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Inativas (sem login há 30+ dias)" icon={Clock} rows={inactive} tone="text-amber-500" />
        <Section title="Em risco (sem login 7-30 dias)" icon={AlertTriangle} rows={atRisk} tone="text-orange-500" />
        <Section title="Nunca acederam" icon={XCircle} rows={neverLogged} tone="text-red-500" />
        <Section title="Pagamentos pendentes" icon={CreditCard} rows={paymentPending} tone="text-red-500" />
      </div>
    </div>
  );
}
