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
import { Wrench, Clock, AlertTriangle, CheckCircle2, HardHat, Camera, ClipboardList } from "lucide-react";

interface TechService {
  id: string;
  number: string | null;
  status: string;
  scheduled_date: string | null;
  vehicles: { plate: string | null; make: string | null; model: string | null } | null;
  clients: { name: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  diagnosis: "Diagnóstico",
  in_progress: "Em curso",
  completed: "Concluído",
  delivered: "Entregue",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  diagnosis: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_progress: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  delivered: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function TechnicianDashboard() {
  const { t } = useLanguage();
  const { user, isReady } = useAuthReady();
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<TechService[]>([]);
  const [inProgress, setInProgress] = useState<TechService[]>([]);
  const [overdue, setOverdue] = useState<TechService[]>([]);
  const [totalDone, setTotalDone] = useState(0);

  useEffect(() => {
    if (!isReady || !user || !shopId) return;
    (async () => {
      setLoading(true);
      const todayIso = new Date().toISOString().slice(0, 10);

      const base = supabase
        .from("work_orders")
        .select("id, number, status, scheduled_date, vehicles(plate,make,model), clients(name)")
        .eq("shop_id", shopId);

      const [todayRes, progressRes, overdueRes, doneRes] = await Promise.all([
        base
          .in("status", ["open", "diagnosis", "in_progress"])
          .eq("scheduled_date", todayIso)
          .order("scheduled_date", { ascending: true })
          .limit(20),
        supabase
          .from("work_orders")
          .select("id, number, status, scheduled_date, vehicles(plate,make,model), clients(name)")
          .eq("shop_id", shopId)
          .eq("status", "in_progress")
          .order("scheduled_date", { ascending: true })
          .limit(20),
        supabase
          .from("work_orders")
          .select("id, number, status, scheduled_date, vehicles(plate,make,model), clients(name)")
          .eq("shop_id", shopId)
          .in("status", ["open", "diagnosis", "in_progress"])
          .lt("scheduled_date", todayIso)
          .order("scheduled_date", { ascending: true })
          .limit(20),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .eq("status", "completed")
          .gte("updated_at", `${todayIso}T00:00:00Z`),
      ]);

      setToday((todayRes.data as any) || []);
      setInProgress((progressRes.data as any) || []);
      setOverdue((overdueRes.data as any) || []);
      setTotalDone(doneRes.count || 0);
      setLoading(false);
    })();
  }, [isReady, user, shopId]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
          <HardHat className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Oficina — Painel do Técnico</h1>
          <p className="text-sm text-muted-foreground">Serviços atribuídos a ti, atrasos e trabalho de hoje.</p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="Serviços hoje" value={today.length} tone="blue" />
        <KpiCard icon={Wrench} label="Em curso" value={inProgress.length} tone="purple" />
        <KpiCard icon={AlertTriangle} label="Em atraso" value={overdue.length} tone="red" />
        <KpiCard icon={CheckCircle2} label="Concluídos hoje" value={totalDone} tone="green" />
      </div>

      {/* Actions rápidas */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="default"><Link to="/workshop"><HardHat className="w-4 h-4 mr-2" />Modo oficina</Link></Button>
        <Button asChild variant="outline"><Link to="/services"><Wrench className="w-4 h-4 mr-2" />Todas as OS</Link></Button>
        <Button asChild variant="outline"><Link to="/agenda"><Clock className="w-4 h-4 mr-2" />Agenda</Link></Button>
      </div>

      {/* Atrasos primeiro (mais prioritário) */}
      {overdue.length > 0 && (
        <ServiceList
          title="Em atraso"
          icon={AlertTriangle}
          tone="border-red-500/40"
          services={overdue}
          emptyLabel=""
        />
      )}

      <ServiceList
        title="Hoje"
        icon={ClipboardList}
        tone="border-blue-500/30"
        services={today}
        emptyLabel="Sem serviços agendados para hoje."
      />

      <ServiceList
        title="Em curso"
        icon={Wrench}
        tone="border-purple-500/30"
        services={inProgress}
        emptyLabel="Nenhum serviço em curso."
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  const toneCls: Record<string, string> = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
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

function ServiceList({
  title, icon: Icon, tone, services, emptyLabel,
}: {
  title: string; icon: any; tone: string; services: TechService[]; emptyLabel: string;
}) {
  return (
    <Card className={`p-4 border-l-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline">{services.length}</Badge>
      </div>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {services.map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between gap-2">
              <Link to={`/services/edit/${s.id}`} className="flex-1 min-w-0 flex items-center gap-2 hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{s.number || "—"}</span>
                <span className="truncate">
                  {s.vehicles?.plate || "s/matrícula"} · {s.vehicles?.make || ""} {s.vehicles?.model || ""}
                </span>
              </Link>
              <Badge variant="outline" className={STATUS_TONE[s.status] || ""}>
                {STATUS_LABEL[s.status] || s.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
