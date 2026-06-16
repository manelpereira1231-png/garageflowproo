import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Store, ShieldCheck, AlertTriangle, Euro, Car, Wrench, IdCard, ArrowRight, Loader2 } from "lucide-react";

type Stats = {
  total_listings: number;
  published: number;
  sold: number;
  pending_inspection: number;
  total_inspections: number;
  escrow_volume: number;
  active_escrows: number;
  disputes_open: number;
  kyc_pending: number;
};

export default function AdminMarketOverview() {
  const navigate = useNavigate();
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [all, pub, sold, pendInsp, insp, escAll, escActive, escDispute, kyc] = await Promise.all([
          supabase.from("carity_listings").select("id", { count: "exact", head: true }),
          supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "published"),
          supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "sold"),
          supabase.from("carity_listings").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "pending_inspection", "inspection_in_progress"]),
          supabase.from("carity_inspections").select("id", { count: "exact", head: true }),
          supabase.from("market_escrow").select("amount").in("status", ["paid", "delivery_confirmed", "released"]),
          supabase.from("market_escrow").select("id", { count: "exact", head: true }).in("status", ["paid", "delivery_confirmed"]),
          supabase.from("market_escrow").select("id", { count: "exact", head: true }).eq("status", "disputed"),
          supabase.from("carity_seller_profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "submitted"),
        ]);

        const volume = (escAll.data || []).reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0);
        setS({
          total_listings: all.count || 0,
          published: pub.count || 0,
          sold: sold.count || 0,
          pending_inspection: pendInsp.count || 0,
          total_inspections: insp.count || 0,
          escrow_volume: volume,
          active_escrows: escActive.count || 0,
          disputes_open: escDispute.count || 0,
          kyc_pending: kyc.count || 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Store className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">GarageFlow Market</h2>
            <p className="text-xs text-muted-foreground">Visão global do marketplace (números reais).</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/admin/market-dashboard")}
          className="text-xs text-amber-500 hover:underline flex items-center gap-1"
        >
          Abrir painel Market <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> A carregar métricas Market…
        </div>
      ) : !s ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={Car} label="Anúncios totais" value={s.total_listings} hint={`${s.published} publicados`} onClick={() => navigate("/admin/market-listings")} />
            <Kpi icon={Wrench} label="Inspeções" value={s.total_inspections} hint={`${s.pending_inspection} a aguardar`} onClick={() => navigate("/admin/market")} accent="purple" />
            <Kpi icon={Euro} label="Volume Escrow" value={`€${s.escrow_volume.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}`} hint={`${s.active_escrows} ativos`} onClick={() => navigate("/admin/market-escrows")} accent="amber" />
            <Kpi icon={ShieldCheck} label="Vendidos" value={s.sold} hint="Escrow concluído" onClick={() => navigate("/admin/market-listings")} accent="emerald" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            <ActionRow
              icon={AlertTriangle}
              label="Disputas em aberto"
              value={s.disputes_open}
              color="text-red-500"
              onClick={() => navigate("/admin/market-escrows")}
            />
            <ActionRow
              icon={IdCard}
              label="KYC pendentes"
              value={s.kyc_pending}
              color="text-amber-500"
              onClick={() => navigate("/admin/market-kyc")}
            />
            <ActionRow
              icon={Store}
              label="Anúncios live"
              value={s.published}
              color="text-emerald-500"
              onClick={() => navigate("/admin/market-listings")}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, onClick, accent }: any) {
  const cls =
    accent === "amber" ? "text-amber-500"
    : accent === "emerald" ? "text-emerald-500"
    : accent === "purple" ? "text-purple-500"
    : "text-primary";
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-border/60 bg-card/60 hover:border-primary/30 transition-colors p-3"
    >
      <Icon className={`w-4 h-4 mb-2 ${cls}`} />
      <p className="text-xl font-bold mono leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </button>
  );
}

function ActionRow({ icon: Icon, label, value, color, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 hover:border-primary/30 transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </button>
  );
}
