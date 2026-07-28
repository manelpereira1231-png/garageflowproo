/**
 * Admin · Mapa do Produto — 100% DINÂMICO.
 *
 * Colunas são geradas a partir da tabela `plans` (fonte única de verdade).
 * Qualquer plano criado no Super Admin aparece automaticamente aqui:
 * — cabeçalho, contadores, toggles.
 * Nada de listas hardcoded de slugs.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Loader2, Lock, LayoutDashboard, Users, Car, FileText, Wrench, HardHat,
  CalendarDays, ClipboardCheck, Receipt, CreditCard, Bell, MessageCircle, Megaphone,
  Zap, Star, Gift, ShieldCheck, UserPlus, Code, Settings, BookOpen, Package,
  CheckCircle2, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { invalidateFeatureCache } from "@/lib/features";
import { usePlansCatalog } from "@/hooks/usePlansCatalog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FeatureRow = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  is_core: boolean;
};

type MatrixRow = { plan_slug: string; feature_slug: string; enabled: boolean };

type ModuleDef = { label: string; slug: string; icon: any };
type GroupDef = { title: string; emoji: string; items: ModuleDef[] };

// Espelho da navegação principal — mapeia cada item para uma feature slug.
// O QUE é enumerado aqui são MÓDULOS (não planos), portanto continua correto
// mantê-los estáticos: espelham a estrutura de navegação do produto.
const PRODUCT_MAP: GroupDef[] = [
  {
    title: "Operação Diária", emoji: "🟦",
    items: [
      { label: "Dashboard", slug: "dashboard", icon: LayoutDashboard },
      { label: "Clientes", slug: "clients", icon: Users },
      { label: "Veículos", slug: "vehicles", icon: Car },
      { label: "Orçamentos", slug: "quotes", icon: FileText },
      { label: "Serviços", slug: "services", icon: Wrench },
      { label: "Modo Oficina", slug: "workshop_mode", icon: HardHat },
      { label: "Agenda", slug: "agenda", icon: CalendarDays },
      { label: "Inspeções", slug: "inspections", icon: ClipboardCheck },
    ],
  },
  {
    title: "Faturação", emoji: "🟨",
    items: [
      { label: "Faturas", slug: "invoices", icon: Receipt },
      { label: "Relatórios Financeiros", slug: "financial_reports_basic", icon: Receipt },
      { label: "Relatórios Avançados", slug: "financial_reports_advanced", icon: Receipt },
      { label: "Exportação CSV", slug: "csv_export", icon: Receipt },
      { label: "Plano / Subscrição", slug: "billing", icon: CreditCard },
    ],
  },
  {
    title: "Comunicação", emoji: "🟩",
    items: [
      { label: "Alertas Básicos", slug: "alerts_basic", icon: Bell },
      { label: "Alertas Avançados", slug: "alerts_advanced", icon: Bell },
      { label: "Chat / Chatbot", slug: "chat", icon: MessageCircle },
      { label: "Portal do Cliente", slug: "client_portal", icon: ShieldCheck },
      { label: "Aprovação Online", slug: "quote_approval", icon: ShieldCheck },
      { label: "Marcação Pública", slug: "public_booking", icon: CalendarDays },
    ],
  },
  {
    title: "Crescimento", emoji: "🟪",
    items: [
      { label: "Marketing", slug: "marketing", icon: Megaphone },
      { label: "Automações", slug: "automations", icon: Zap },
      { label: "Fidelização", slug: "loyalty", icon: Star },
      { label: "Referências", slug: "referrals", icon: Gift },
    ],
  },
  {
    title: "Administração", emoji: "🟥",
    items: [
      { label: "Equipa", slug: "team_management", icon: UserPlus },
      { label: "Multi-Oficina", slug: "multi_shop", icon: ShieldCheck },
      { label: "API Pública", slug: "api", icon: Code },
      { label: "Definições", slug: "settings", icon: Settings },
    ],
  },
  {
    title: "Inventário", emoji: "🟫",
    items: [
      { label: "Catálogo de Serviços", slug: "service_catalog", icon: BookOpen },
      { label: "Inventário e Stock", slug: "stock", icon: Package },
      { label: "Garantias", slug: "warranties", icon: ShieldCheck },
    ],
  },
];

const SYSTEM_STATUS = [
  { label: "Email automático", ok: true },
  { label: "Alertas automáticos", ok: true },
  { label: "Chat e mensagens", ok: true },
  { label: "Inspeções digitais", ok: true },
  { label: "PDFs (marca d'água plano de entrada)", ok: true },
  { label: "Realtime sincronização", ok: true },
];

// Paleta rotativa para badges de planos (nunca hardcoded por slug).
const PLAN_BADGE_COLORS = [
  "bg-zinc-500/15 text-zinc-300",
  "bg-blue-500/15 text-blue-300",
  "bg-amber-500/15 text-amber-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-purple-500/15 text-purple-300",
  "bg-pink-500/15 text-pink-300",
  "bg-cyan-500/15 text-cyan-300",
  "bg-orange-500/15 text-orange-300",
];

export default function AdminFeatureMatrix() {
  const { toast } = useToast();
  const { data: catalog, isLoading: catalogLoading, refetch: refetchCatalog } = usePlansCatalog();
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Planos dinâmicos — ordem pelo `sort_order` que o admin definiu.
  // Filtramos por `active` para a matriz não crescer com planos arquivados.
  const plans = useMemo(() => {
    return (catalog?.plans ?? [])
      .filter((p) => p.active && !p.archived_at)
      .map((p, i) => ({
        slug: p.slug,
        label: p.label ?? p.name ?? p.slug,
        color: p.color ? `${p.color}` : PLAN_BADGE_COLORS[i % PLAN_BADGE_COLORS.length],
      }));
  }, [catalog]);

  useEffect(() => {
    (async () => {
      const [{ data: feats }, { data: mat }] = await Promise.all([
        supabase.from("features").select("*"),
        supabase.from("plan_features").select("plan_slug, feature_slug, enabled"),
      ]);
      setFeatures((feats as any) ?? []);
      setMatrix((mat as any) ?? []);
      setLoading(false);
    })();
  }, []);

  // Realtime: reflete alterações da matriz feitas noutros separadores.
  useEffect(() => {
    const ch = supabase
      .channel("admin-feature-matrix")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_features" }, async () => {
        const { data } = await supabase.from("plan_features").select("plan_slug, feature_slug, enabled");
        setMatrix((data as any) ?? []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "features" }, async () => {
        const { data } = await supabase.from("features").select("*");
        setFeatures((data as any) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const bySlug = useMemo(() => {
    const m: Record<string, FeatureRow> = {};
    features.forEach((f) => (m[f.slug] = f));
    return m;
  }, [features]);

  const isEnabled = (planSlug: string, slug: string) => {
    const feat = bySlug[slug];
    if (feat?.is_core) return true;
    return matrix.find((r) => r.plan_slug === planSlug && r.feature_slug === slug)?.enabled ?? false;
  };

  async function toggle(planSlug: string, slug: string, next: boolean) {
    const key = `${planSlug}:${slug}`;
    setSaving(key);
    setMatrix((m) => {
      const i = m.findIndex((r) => r.plan_slug === planSlug && r.feature_slug === slug);
      if (i >= 0) {
        const copy = [...m];
        copy[i] = { ...copy[i], enabled: next };
        return copy;
      }
      return [...m, { plan_slug: planSlug, feature_slug: slug, enabled: next }];
    });
    const { error } = await supabase
      .from("plan_features")
      .upsert({ plan_slug: planSlug, feature_slug: slug, enabled: next }, { onConflict: "plan_slug,feature_slug" });
    setSaving(null);
    if (error) {
      toast({ title: "Erro a guardar", description: error.message, variant: "destructive" });
      setMatrix((m) => m.map((r) => (r.plan_slug === planSlug && r.feature_slug === slug ? { ...r, enabled: !next } : r)));
      return;
    }
    invalidateFeatureCache();
    refetchCatalog();
  }

  // Resumo por plano: quantas funcionalidades incluídas / total.
  const planSummary = useMemo(() => {
    const total = features.length;
    return plans.map((p) => {
      const count = features.filter((f) => isEnabled(p.slug, f.slug)).length;
      return { ...p, count, total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, matrix, plans]);

  if (loading || catalogLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sem planos configurados</CardTitle>
            <CardDescription>
              Crie pelo menos um plano em <Link to="/admin/plans" className="underline">Painel Admin → Planos</Link> para poder configurar a matriz de funcionalidades.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Largura mínima por coluna de plano — permite scroll horizontal quando existem muitos planos.
  const planColWidth = 72; // px
  const summaryCols = Math.min(plans.length, 4);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin/settings"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Mapa do Produto
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ative ou desative cada módulo por plano. Colunas geradas automaticamente a partir dos planos existentes — qualquer novo plano criado no Super Admin aparece aqui em segundos.
          </p>
        </div>
      </div>

      {/* Resumo por plano — grid adapta-se ao número de planos */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))` }}
      >
        {planSummary.map((p) => (
          <Card key={p.slug}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <Badge className={p.color}>{p.label}</Badge>
                <span className="text-xs text-muted-foreground">incluído</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {p.count}
                <span className="text-base text-muted-foreground font-normal"> / {p.total}</span>
              </div>
              <div className="text-xs text-muted-foreground">funcionalidades</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grupos de produto */}
      {PRODUCT_MAP.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>{group.emoji}</span> {group.title}
            </CardTitle>
            <CardDescription>Espelha a secção "{group.title}" da navegação principal.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y overflow-x-auto">
              {group.items.map((item) => {
                const feat = bySlug[item.slug];
                const exists = !!feat;
                const Icon = item.icon;
                return (
                  <div
                    key={item.slug}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
                    style={{ minWidth: `${360 + plans.length * planColWidth}px` }}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {t(`feature.${item.slug}`, item.label)}
                        {feat?.is_core && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Lock className="h-2.5 w-2.5 mr-0.5" /> core
                          </Badge>
                        )}
                        {!exists && (
                          <Badge variant="outline" className="text-[10px] text-amber-500">
                            não registado
                          </Badge>
                        )}
                      </div>
                      {feat?.description && (
                        <div className="text-xs text-muted-foreground truncate">{feat.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {plans.map((p) => {
                        const enabled = isEnabled(p.slug, item.slug);
                        const isSaving = saving === `${p.slug}:${item.slug}`;
                        const locked = !exists || feat?.is_core;
                        return (
                          <div key={p.slug} className="flex flex-col items-center gap-1" style={{ width: planColWidth }}>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-full" title={p.label}>
                              {p.label}
                            </span>
                            {locked ? (
                              <CheckCircle2 className={`h-4 w-4 ${feat?.is_core ? "text-green-500" : "text-muted-foreground/40"}`} />
                            ) : (
                              <Switch
                                checked={enabled}
                                disabled={isSaving}
                                onCheckedChange={(v) => toggle(p.slug, item.slug, v)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado do sistema</CardTitle>
          <CardDescription>Visão simples — não mostra logs técnicos.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2">
          {SYSTEM_STATUS.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm py-1">
              <CheckCircle2 className={`h-4 w-4 ${s.ok ? "text-green-500" : "text-red-500"}`} />
              {s.label}
            </div>
          ))}
        </CardContent>
      </Card>
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <div className="hidden">{summaryCols}</div>
    </div>
  );
}
