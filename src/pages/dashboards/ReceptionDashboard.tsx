import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Users, Car, FileText, LogIn, LogOut, PhoneCall } from "lucide-react";

interface Appointment {
  id: string;
  date: string;
  time: string | null;
  status: string | null;
  clients: { name: string | null } | null;
  vehicles: { plate: string | null } | null;
}

export default function ReceptionDashboard() {
  const { t } = useLanguage();
  const { user, isReady } = useAuthReady();
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [pendingCheckin, setPendingCheckin] = useState(0);
  const [pendingCheckout, setPendingCheckout] = useState(0);
  const [newClientsWeek, setNewClientsWeek] = useState(0);

  useEffect(() => {
    if (!isReady || !user || !shopId) return;
    (async () => {
      setLoading(true);
      const todayIso = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

      const [apptRes, checkinRes, checkoutRes, clientsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, date, time, status, clients(name), vehicles(plate)")
          .eq("shop_id", shopId)
          .eq("date", todayIso)
          .order("time", { ascending: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .in("status", ["scheduled", "confirmed"])
          .eq("date", todayIso),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .eq("status", "completed"),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .gte("created_at", weekAgo.toISOString())
          .is("deleted_at", null),
      ]);

      setTodayAppts((apptRes.data as any) || []);
      setPendingCheckin(checkinRes.count || 0);
      setPendingCheckout(checkoutRes.count || 0);
      setNewClientsWeek(clientsRes.count || 0);
      setLoading(false);
    })();
  }, [isReady, user, shopId]);

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30">
          <PhoneCall className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Receção — Painel do dia</h1>
          <p className="text-sm text-muted-foreground">Agenda, check-in/out, clientes e viaturas.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CalendarDays} label="Marcações hoje" value={todayAppts.length} tone="blue" />
        <StatCard icon={LogIn} label="Check-in pendente" value={pendingCheckin} tone="purple" />
        <StatCard icon={LogOut} label="Prontos p/ entrega" value={pendingCheckout} tone="green" />
        <StatCard icon={Users} label="Novos clientes (7d)" value={newClientsWeek} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/agenda"><CalendarDays className="w-4 h-4 mr-2" />Agenda completa</Link></Button>
        <Button asChild variant="outline"><Link to="/clients"><Users className="w-4 h-4 mr-2" />Clientes</Link></Button>
        <Button asChild variant="outline"><Link to="/vehicles"><Car className="w-4 h-4 mr-2" />Viaturas</Link></Button>
        <Button asChild variant="outline"><Link to="/quotes"><FileText className="w-4 h-4 mr-2" />Orçamentos</Link></Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Marcações de hoje</h2>
          <Badge variant="outline">{todayAppts.length}</Badge>
        </div>
        {todayAppts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem marcações para hoje.</p>
        ) : (
          <ul className="divide-y divide-border">
            {todayAppts.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {a.time ? String(a.time).slice(0, 5) : "—"}
                  </span>
                  <span className="truncate">
                    {a.clients?.name || "Sem cliente"} · {a.vehicles?.plate || "—"}
                  </span>
                </div>
                <Badge variant="outline">{a.status || "agendado"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  const toneCls: Record<string, string> = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  };
  return (
    <Card className={`p-4 ${toneCls[tone]} border`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </Card>
  );
}
