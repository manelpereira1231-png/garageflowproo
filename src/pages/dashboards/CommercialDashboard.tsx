import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, FileText, Target, MessageCircle, CheckCircle2 } from "lucide-react";

interface Quote {
  id: string;
  number: string | null;
  status: string;
  total: number | null;
  created_at: string;
  clients: { name: string | null } | null;
}

export default function CommercialDashboard() {
  const { user, isReady } = useAuthReady();
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [openQuotes, setOpenQuotes] = useState<Quote[]>([]);
  const [newClientsMonth, setNewClientsMonth] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [totalPipeline, setTotalPipeline] = useState(0);

  useEffect(() => {
    if (!isReady || !user || !shopId) return;
    (async () => {
      setLoading(true);
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

      const [quotesRes, clientsRes, allQuotesRes, approvedRes] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, number, status, total, created_at, clients(name)")
          .eq("shop_id", shopId)
          .in("status", ["draft", "sent", "pending"])
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .gte("created_at", startOfMonth.toISOString())
          .is("deleted_at", null),
        supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .eq("status", "approved")
          .gte("created_at", startOfMonth.toISOString()),
      ]);

      const open = (quotesRes.data as any) || [];
      setOpenQuotes(open);
      setTotalPipeline(open.reduce((s: number, q: Quote) => s + Number(q.total || 0), 0));
      setNewClientsMonth(clientsRes.count || 0);
      const total = allQuotesRes.count || 0;
      const approved = approvedRes.count || 0;
      setConversionRate(total > 0 ? Math.round((approved / total) * 100) : 0);
      setLoading(false);
    })();
  }, [isReady, user, shopId]);

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Comercial — Pipeline &amp; CRM</h1>
          <p className="text-sm text-muted-foreground">Leads, orçamentos abertos e conversão do mês.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Orçamentos abertos" value={openQuotes.length} tone="blue" />
        <StatCard icon={Target} label="Pipeline (€)" value={`€${totalPipeline.toFixed(0)}`} tone="emerald" />
        <StatCard icon={CheckCircle2} label="Conversão" value={`${conversionRate}%`} tone="purple" />
        <StatCard icon={Users} label="Novos clientes (mês)" value={newClientsMonth} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/quotes/new"><FileText className="w-4 h-4 mr-2" />Novo orçamento</Link></Button>
        <Button asChild variant="outline"><Link to="/clients"><Users className="w-4 h-4 mr-2" />Clientes</Link></Button>
        <Button asChild variant="outline"><Link to="/quotes"><FileText className="w-4 h-4 mr-2" />Pipeline</Link></Button>
        <Button asChild variant="outline"><Link to="/chat"><MessageCircle className="w-4 h-4 mr-2" />Chat</Link></Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Pipeline — orçamentos abertos</h2>
          <Badge variant="outline">{openQuotes.length}</Badge>
        </div>
        {openQuotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem orçamentos em aberto. Cria um novo para começar.</p>
        ) : (
          <ul className="divide-y divide-border">
            {openQuotes.map((q) => (
              <li key={q.id} className="py-2 flex items-center justify-between gap-2">
                <Link to={`/quotes/edit/${q.id}`} className="flex-1 min-w-0 flex items-center gap-2 hover:underline">
                  <span className="font-mono text-xs text-muted-foreground">{q.number || "—"}</span>
                  <span className="truncate">{q.clients?.name || "Sem cliente"}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">€{Number(q.total || 0).toFixed(2)}</span>
                  <Badge variant="outline">{q.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone: string }) {
  const toneCls: Record<string, string> = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  };
  return (
    <Card className={`p-4 ${toneCls[tone]} border`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
    </Card>
  );
}
