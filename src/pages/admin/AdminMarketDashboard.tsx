import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle, Euro, Car, Users } from "lucide-react";

interface KPIs {
  total_listings: number;
  published: number;
  pending_inspection: number;
  sold: number;
  total_inspections: number;
  approval_rate: number;
  avg_days_to_sell: number;
  total_escrow_volume: number;
  active_escrows: number;
  disputes_open: number;
  satisfaction_cancellations: number;
  kyc_pending: number;
  suspended_users: number;
}

export default function AdminMarketDashboard() {
  const [k, setK] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        listingsAll,
        listingsPub,
        listingsPending,
        listingsSold,
        inspectionsAll,
        inspectionsApproved,
        soldListings,
        escrowAll,
        escrowActive,
        escrowDisputed,
        escrowCancelled48h,
        kycPending,
        suspended,
      ] = await Promise.all([
        supabase.from("carity_listings").select("id", { count: "exact", head: true }),
        supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("carity_listings").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "pending_inspection", "inspection_in_progress"]),
        supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "sold"),
        supabase.from("carity_inspections").select("id", { count: "exact", head: true }),
        supabase.from("carity_inspection_reports").select("id", { count: "exact", head: true }).eq("recommendation", "recommended"),
        supabase.from("carity_listings").select("created_at, sold_at").eq("status", "sold").not("sold_at", "is", null).limit(500),
        supabase.from("market_escrow").select("amount", { count: "exact" }).in("status", ["paid", "delivery_confirmed", "released"]),
        supabase.from("market_escrow").select("id", { count: "exact", head: true }).in("status", ["paid", "delivery_confirmed"]),
        supabase.from("market_escrow").select("id", { count: "exact", head: true }).eq("status", "disputed"),
        supabase.from("market_escrow").select("id", { count: "exact", head: true }).eq("cancelled_within_window", true),
        supabase.from("carity_seller_profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "submitted"),
        supabase.from("carity_seller_profiles").select("id", { count: "exact", head: true }).not("suspended_at", "is", null),
      ]);

      const days = (soldListings.data || [])
        .map((r: any) => {
          if (!r.sold_at || !r.created_at) return null;
          return (new Date(r.sold_at).getTime() - new Date(r.created_at).getTime()) / 86400000;
        })
        .filter((d): d is number => d !== null);
      const avgDays = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;

      const totalInsp = inspectionsAll.count || 0;
      const approvedInsp = inspectionsApproved.count || 0;
      const approvalRate = totalInsp > 0 ? (approvedInsp / totalInsp) * 100 : 0;

      const totalVolume = (escrowAll.data || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

      setK({
        total_listings: listingsAll.count || 0,
        published: listingsPub.count || 0,
        pending_inspection: listingsPending.count || 0,
        sold: listingsSold.count || 0,
        total_inspections: totalInsp,
        approval_rate: approvalRate,
        avg_days_to_sell: avgDays,
        total_escrow_volume: totalVolume,
        active_escrows: escrowActive.count || 0,
        disputes_open: escrowDisputed.count || 0,
        satisfaction_cancellations: escrowCancelled48h.count || 0,
        kyc_pending: kycPending.count || 0,
        suspended_users: suspended.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading || !k) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold">GarageFlow Market — Painel</h1>
        <p className="text-sm text-muted-foreground">Métricas operacionais e financeiras do marketplace.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Car} label="Anúncios totais" value={k.total_listings} hint={`${k.published} publicados`} />
        <KPICard icon={ShieldCheck} label="Inspeções concluídas" value={k.total_inspections} hint={`Taxa aprovação ${k.approval_rate.toFixed(0)}%`} accent="emerald" />
        <KPICard icon={Clock} label="Dias médios até venda" value={k.avg_days_to_sell.toFixed(1)} hint="das últimas 500 vendas" />
        <KPICard icon={Euro} label="Volume Escrow" value={`€${k.total_escrow_volume.toLocaleString("pt-PT")}`} hint={`${k.active_escrows} ativos`} accent="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Funil de Anúncios</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <FunnelRow icon={Clock} label="Pagamento/Inspeção pendente" value={k.pending_inspection} color="text-amber-600" />
            <FunnelRow icon={CheckCircle} label="Publicados" value={k.published} color="text-emerald-600" />
            <FunnelRow icon={ShieldCheck} label="Vendidos" value={k.sold} color="text-blue-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saúde Operacional</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <FunnelRow icon={AlertTriangle} label="Disputas em aberto" value={k.disputes_open} color="text-red-600" />
            <FunnelRow icon={XCircle} label="Cancelamentos 48h satisfação" value={k.satisfaction_cancellations} color="text-orange-600" />
            <FunnelRow icon={Users} label="Utilizadores suspensos" value={k.suspended_users} color="text-slate-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Verificação Identidade</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <FunnelRow icon={Clock} label="KYC à espera de revisão" value={k.kyc_pending} color="text-amber-600" />
            {k.kyc_pending > 0 ? (
              <a href="/admin/market-kyc" className="text-xs text-amber-600 hover:underline">Rever submissões →</a>
            ) : (
              <p className="text-xs text-muted-foreground">Sem submissões pendentes.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, hint, accent }: any) {
  const accentCls = accent === "emerald" ? "text-emerald-600" : accent === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <Icon className={`h-4 w-4 ${accentCls}`} />
          <Badge variant="outline" className="text-[10px]">live</Badge>
        </div>
        <p className="text-2xl font-bold mt-2">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function FunnelRow({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs">{label}</span>
      </div>
      <span className={`font-bold text-sm ${color}`}>{value}</span>
    </div>
  );
}
