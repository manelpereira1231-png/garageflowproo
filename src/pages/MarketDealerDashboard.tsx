import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MarketLayout from "@/components/MarketLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Car, Eye, MessageCircle, ShieldCheck, Plus, ArrowRight, ExternalLink,
  Crown, Zap, Award, TrendingUp, Settings, Globe, FileCheck, AlertTriangle, Sparkles, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

type DealerPlan = "free" | "starter" | "pro" | "unlimited";

const PLANS: Record<DealerPlan, { label: string; price: string; max: number; color: string; features: string[] }> = {
  free: { label: "Sem plano", price: "—", max: 1, color: "slate", features: ["1 carro publicado", "Comissão 3%"] },
  starter: { label: "Starter", price: "39€/mês", max: 10, color: "amber", features: ["10 carros ativos", "Comissão 1%", "Página pública /stand", "SEO básico"] },
  pro: { label: "Pro", price: "99€/mês", max: 30, color: "amber", features: ["30 carros ativos", "Comissão 1%", "Destaque nos resultados", "SEO avançado", "Suporte prioritário"] },
  unlimited: { label: "Unlimited", price: "249€/mês", max: 9999, color: "amber", features: ["Carros ilimitados", "Comissão 1%", "Topo dos resultados", "Banner premium", "Suporte dedicado"] },
};

export default function MarketDealerDashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, published: 0, pendingInspection: 0, sold: 0, views: 0, unread: 0, offers: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [pendingPay, setPendingPay] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (params.get("upgraded")) {
      toast.success("Plano ativado! A sincronizar...");
      void syncSubscription();
    } else if (params.get("canceled")) {
      toast.info("Pagamento cancelado.");
    }
  }, [params]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth?account=dealer"); return; }

    const { data: prof } = await supabase
      .from("carity_seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!prof || prof.account_type !== "dealer") {
      toast.error("Esta conta não é de Stand.");
      navigate("/market/dashboard");
      return;
    }
    setProfile(prof);

    const { data: listings } = await supabase
      .from("carity_listings")
      .select("id, title, status, price, views_count, created_at, photos")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const arr = listings || [];
    const totalViews = arr.reduce((s: number, l: any) => s + (l.views_count || 0), 0);
    const pendingPayment = arr.filter((l: any) => l.status === "pending_payment");
    setStats({
      total: arr.length,
      published: arr.filter((l: any) => l.status === "published").length,
      pendingInspection: arr.filter((l: any) => ["pending_inspection", "inspection_in_progress"].includes(l.status)).length,
      sold: arr.filter((l: any) => l.status === "sold").length,
      views: totalViews,
      unread: 0,
      offers: pendingPayment.length,
    });
    setRecent(arr.slice(0, 6));
    setPendingPay(pendingPayment);

    const { data: ins } = await (supabase as any)
      .from("carity_inspections")
      .select("id, status, scheduled_at, listing_id, shop_id, carity_listings(title)")
      .eq("seller_id", user.id)
      .in("status", ["pending", "scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(5);
    setInspections((ins as any[]) || []);

    setLoading(false);

    // Sync stripe state in background
    void syncSubscription();
  };

  const syncSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-dealer-subscription");
      if (error) return;
      if (data?.plan) {
        setProfile((p: any) => p ? { ...p, dealer_plan: data.plan, dealer_subscription_status: data.status, dealer_active_until: data.period_end } : p);
      }
    } catch {}
  };

  const upgrade = async (plan: DealerPlan) => {
    if (plan === "free") return;
    setBusy(plan);
    try {
      const { data, error } = await supabase.functions.invoke("dealer-checkout", { body: { plan } });
      if (error || !data?.url) throw new Error(data?.error || error?.message || "Erro a abrir checkout");
      // Open in new tab to bypass popup blockers issues
      const win = window.open(data.url, "_blank");
      if (!win) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      const { data, error } = await supabase.functions.invoke("dealer-checkout", { body: { action: "portal" } });
      if (error || !data?.url) throw new Error(data?.error || error?.message || "Erro a abrir portal");
      const win = window.open(data.url, "_blank");
      if (!win) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const currentPlan: DealerPlan = (profile?.dealer_plan as DealerPlan) || "free";
  const planMeta = PLANS[currentPlan];
  const quotaPct = Math.min(100, Math.round((stats.total / Math.max(planMeta.max, 1)) * 100));
  const slug = profile?.dealer_slug;

  if (loading) {
    return (
      <MarketLayout>
        <div className="container max-w-7xl mx-auto p-4 space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </MarketLayout>
    );
  }

  return (
    <MarketLayout>
      <div className="container max-w-7xl mx-auto p-4 space-y-6">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <Building2 className="w-7 h-7 text-slate-900" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Painel de Stand</p>
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{profile?.dealer_company_name || "O meu Stand"}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={`text-[10px] ${currentPlan === "free" ? "bg-slate-700 text-slate-300" : "bg-amber-500 text-slate-900"}`}>
                    {currentPlan === "unlimited" && <Crown className="w-3 h-3 mr-1" />}
                    {planMeta.label}
                  </Badge>
                  {profile?.verified && (
                    <Badge className="text-[10px] bg-emerald-600/20 text-emerald-300 border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verificado
                    </Badge>
                  )}
                  {slug && (
                    <Link to={`/market/stand/${slug}`} target="_blank" className="text-[11px] text-amber-400 hover:underline flex items-center gap-1">
                      <Globe className="w-3 h-3" /> /stand/{slug} <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button asChild className="flex-1 sm:flex-none bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold">
                <Link to="/market/sell"><Plus className="w-4 h-4 mr-1" /> Publicar carro</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 sm:flex-none border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10">
                <Link to="/market/dealer/bulk"><Sparkles className="w-4 h-4 mr-1" /> Bulk listing</Link>
              </Button>
              {currentPlan !== "free" && (
                <Button variant="outline" disabled={busy === "portal"} onClick={openPortal} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
                  <Settings className="w-4 h-4 mr-1" /> Subscrição
                </Button>
              )}
            </div>
          </div>

          {/* Quota bar */}
          <div className="mt-5 bg-slate-900/60 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Quota de viaturas ({planMeta.label})</span>
              <span className="text-white font-semibold">{stats.total} / {planMeta.max === 9999 ? "∞" : planMeta.max}</span>
            </div>
            <Progress value={quotaPct} className="h-2 bg-slate-800" />
            {quotaPct >= 80 && currentPlan !== "unlimited" && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400">
                <AlertTriangle className="w-3 h-3" /> A aproximar-se do limite — considere upgrade.
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={Car} label="Publicados" value={stats.published} color="amber" />
          <KpiCard icon={FileCheck} label="Em inspeção" value={stats.pendingInspection} color="blue" />
          <KpiCard icon={Eye} label="Visualizações" value={stats.views} color="violet" />
          <KpiCard icon={CheckCircle2} label="Vendidos" value={stats.sold} color="emerald" />
        </div>

        {pendingPay.length > 0 && (
          <Card className="bg-gradient-to-br from-amber-500/15 to-slate-900 border-amber-500/40">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{pendingPay.length} viatura(s) à espera de pagamento da inspeção</p>
                    <p className="text-xs text-slate-400 mt-0.5">A inspeção independente é cobrada diretamente no teu cartão via Stripe — nunca há pagamentos manuais.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {pendingPay.slice(0, 3).map((l) => (
                    <Button key={l.id} asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                      <Link to={`/market/pay/${l.id}`}>Pagar {l.plate || l.id.slice(0, 6)}</Link>
                    </Button>
                  ))}
                  {pendingPay.length > 3 && (
                    <Button asChild size="sm" variant="outline" className="border-amber-500/40 text-amber-300">
                      <Link to="/market/profile">Ver todos ({pendingPay.length})</Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-[1fr,360px] gap-6">
          {/* Recent listings + inspections */}
          <div className="space-y-6">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Car className="w-4 h-4 text-amber-400" /> Inventário recente
                  </h2>
                  <Link to="/market/profile" className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                    Ver tudo <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    <Car className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <p>Sem viaturas publicadas.</p>
                    <Button asChild size="sm" className="mt-3 bg-amber-500 hover:bg-amber-400 text-slate-900">
                      <Link to="/market/sell">Publicar a primeira</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recent.map((l) => (
                      <Link
                        key={l.id}
                        to={`/market/listing/${l.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-amber-500/30 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-md bg-slate-800 overflow-hidden shrink-0">
                          {l.photos?.[0] && <img src={l.photos[0]} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{l.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{l.status}</Badge>
                            <span className="text-[11px] text-slate-500">{(l.views_count || 0)} vistas</span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-amber-400">{Number(l.price || 0).toLocaleString("pt-PT")}€</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-5">
                <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Inspeções independentes
                </h2>
                {inspections.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Sem inspeções agendadas.</p>
                ) : (
                  <div className="space-y-2">
                    {inspections.map((i) => (
                      <div key={i.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{i.carity_listings?.title || "Viatura"}</p>
                          <p className="text-[11px] text-slate-500">
                            {i.scheduled_at ? new Date(i.scheduled_at).toLocaleString("pt-PT") : "Por agendar"}
                          </p>
                        </div>
                        <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">{i.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-3 flex items-start gap-1.5">
                  <ShieldCheck className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
                  Inspeções obrigatoriamente feitas por oficinas independentes — anti-fraude garantido.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Plans column */}
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-amber-500/10 to-slate-900 border-amber-500/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-white font-semibold text-sm">Plano atual</h3>
                </div>
                <p className="text-2xl font-bold text-white">{planMeta.label}</p>
                <p className="text-amber-400 text-sm font-medium">{planMeta.price}</p>
                {profile?.dealer_active_until && currentPlan !== "free" && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Renova em {new Date(profile.dealer_active_until).toLocaleDateString("pt-PT")}
                  </p>
                )}
                <ul className="mt-3 space-y-1.5">
                  {planMeta.features.map((f, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold px-1">
                {currentPlan === "free" ? "Ativar plano" : "Mudar de plano"}
              </p>
              {(["starter", "pro", "unlimited"] as DealerPlan[])
                .filter((p) => p !== currentPlan)
                .map((p) => {
                  const m = PLANS[p];
                  const Icon = p === "unlimited" ? Crown : p === "pro" ? TrendingUp : Zap;
                  return (
                    <button
                      key={p}
                      disabled={busy === p}
                      onClick={() => upgrade(p)}
                      className="w-full text-left bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-amber-400" />
                          <div>
                            <p className="text-sm font-semibold text-white">{m.label}</p>
                            <p className="text-[11px] text-slate-400">Até {m.max === 9999 ? "ilimitados" : m.max} carros · 1% comissão</p>
                          </div>
                        </div>
                        <span className="text-amber-400 text-sm font-semibold">{m.price}</span>
                      </div>
                    </button>
                  );
                })}
            </div>

            <Card className="bg-slate-900/40 border-slate-800">
              <CardContent className="p-4 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-start gap-1.5"><Award className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" /> Comissão reduzida de 3% → 1% em todos os planos.</div>
                <div className="flex items-start gap-1.5"><Globe className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" /> Página pública dedicada com SEO.</div>
                <div className="flex items-start gap-1.5"><ShieldCheck className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" /> Inspeções independentes obrigatórias — confiança total.</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MarketLayout>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400",
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400",
    violet: "from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-3.5`}>
      <Icon className="w-4 h-4 mb-1.5" />
      <p className="text-2xl font-bold text-white leading-none">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{label}</p>
    </div>
  );
}
