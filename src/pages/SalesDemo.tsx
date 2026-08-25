/**
 * GARAGEFLOW SALES DEMO PRO — /demo-demonstracao
 *
 * Camada de apresentação comercial 100% isolada. NÃO altera nada do ERP:
 * apenas lê preços reais (country_settings via useCountryPricing) e limites
 * reais (platform_settings via loadPlatformSettings) e faz deep-link para as
 * páginas existentes do GarageFlow. Nenhuma credencial é usada/exposta aqui.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, BarChart3, Target, Check, ChevronRight, ChevronLeft, RotateCcw,
  Eye, EyeOff, Presentation, Lightbulb, MessageSquareWarning, ClipboardCopy,
  Users, Car, FileText, Wrench, LayoutDashboard, Package, ListChecks,
  History, Sparkles, ExternalLink, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCountryPricing } from "@/hooks/useCountryPricing";
import {
  loadPlatformSettings, DEFAULT_PLATFORM_SETTINGS, type PlatformSettings,
} from "@/lib/platformSettings";
import { toast } from "sonner";

/* ------------------------------------------------------------------ state */

type Answers = {
  team?: "1" | "2-5" | "6-10" | "11+";
  vehicles?: "1-25" | "26-50" | "51-100" | "100+";
  users?: "1" | "2-5" | "6-10" | "11+";
  software?: "nao" | "sim";
  pain?: string;
  profile?: string;
};

type Phase = "home" | "qualify" | "profile" | "mode" | "run" | "plans" | "summary";

type StepKey =
  | "dashboard" | "client" | "vehicle" | "history" | "quote" | "parts"
  | "services" | "repair" | "tasks" | "metrics" | "plans" | "compare"
  | "recommendation" | "conversion";

const STEP_META: Record<StepKey, {
  label: string; icon: any; link?: string; script: string; value: string;
}> = {
  dashboard: {
    label: "Dashboard", icon: LayoutDashboard, link: "/dashboard",
    script: "Aqui consegue perceber rapidamente o que está a acontecer na oficina.",
    value: "Estado da oficina num só ecrã: serviços em curso, orçamentos e faturação do mês.",
  },
  client: {
    label: "Cliente", icon: Users, link: "/clients",
    script: "Este é o cliente. Toda a comunicação e viaturas ficam ligadas a esta ficha.",
    value: "Cada cliente tem viaturas, orçamentos e serviços associados — sem folhas soltas.",
  },
  vehicle: {
    label: "Viatura", icon: Car, link: "/vehicles",
    script: "Aqui fica centralizado o histórico desta viatura.",
    value: "Toda a informação desta viatura fica centralizada.",
  },
  history: {
    label: "Histórico", icon: History, link: "/vehicles",
    script: "Consegue ver tudo o que já foi feito nesta viatura, e quando.",
    value: "O histórico acompanha a viatura — mesmo que mude de responsável na oficina.",
  },
  quote: {
    label: "Orçamento", icon: FileText, link: "/quotes",
    script: "Agora vamos transformar este trabalho num orçamento.",
    value: "O orçamento sai em PDF e pode ser aprovado digitalmente pelo cliente.",
  },
  parts: {
    label: "Peças", icon: Package, link: "/stock",
    script: "As peças usadas no trabalho saem do stock automaticamente.",
    value: "Stock e custo real do trabalho ficam ligados à reparação.",
  },
  services: {
    label: "Serviços", icon: Wrench, link: "/services",
    script: "Esta é a lista de trabalhos da oficina, com o estado de cada um.",
    value: "A equipa consegue acompanhar o estado do trabalho.",
  },
  repair: {
    label: "Reparação", icon: Wrench, link: "/services",
    script: "Depois da aprovação, o trabalho passa para a reparação.",
    value: "O orçamento e a reparação ficam ligados ao histórico da viatura.",
  },
  tasks: {
    label: "Tarefas", icon: ListChecks, link: "/workshop",
    script: "No modo oficina, cada técnico vê o que tem para fazer.",
    value: "Menos perguntas na oficina: o trabalho está atribuído e visível.",
  },
  metrics: {
    label: "Métricas", icon: BarChart3, link: "/reports/financial",
    script: "E aqui vê os números: faturação, serviços e evolução.",
    value: "Decisões com base em números reais da oficina, não em memória.",
  },
  plans: {
    label: "Planos", icon: BarChart3,
    script: "Agora vamos ver o que muda entre os diferentes níveis.",
    value: "Paga apenas pelo que precisa hoje — pode subir a qualquer momento.",
  },
  compare: {
    label: "Comparação", icon: BarChart3,
    script: "Vamos comparar apenas o que é relevante para a sua oficina.",
    value: "Comparação honesta: só mostramos o que muda para o seu caso.",
  },
  recommendation: {
    label: "Recomendação", icon: Target,
    script: "Com base no que me disse, este é o plano mais adequado.",
    value: "Recomendamos o plano adequado, não o mais caro.",
  },
  conversion: {
    label: "Conversão", icon: Rocket,
    script: "Podemos começar hoje mesmo, com os seus dados.",
    value: "Arranque rápido: criar conta e começar a usar no mesmo dia.",
  },
};

const EXPRESS: StepKey[] = ["dashboard", "vehicle", "quote", "repair", "plans", "recommendation", "conversion"];
const FULL: StepKey[] = ["dashboard", "client", "vehicle", "history", "quote", "parts", "services", "repair", "tasks", "metrics", "plans", "compare", "recommendation", "conversion"];

function adaptOrder(base: StepKey[], pain?: string): StepKey[] {
  const priority: Record<string, StepKey[]> = {
    "Orçamentos": ["client", "vehicle", "quote", "repair"],
    "Histórico das viaturas": ["client", "vehicle", "history"],
    "Organização": ["dashboard", "tasks", "repair", "metrics"],
    "Gestão da reparação": ["dashboard", "repair", "services", "metrics"],
    "Relatórios": ["dashboard", "metrics"],
    "Faturação": ["quote", "repair", "metrics"],
    "Comunicação com clientes": ["client", "quote", "repair"],
  };
  const first = (priority[pain || ""] || []).filter((s) => base.includes(s));
  return [...first, ...base.filter((s) => !first.includes(s))];
}

const OBJECTIONS = [
  { q: "Já tenho um sistema.", a: "Sem problema. O GarageFlow permite importar clientes e viaturas a partir de ficheiros (Excel/CSV), e o histórico fica associado às viaturas. Pode correr em paralelo durante o período de experiência." },
  { q: "É caro.", a: "Só paga o plano de que precisa e pode mudar a qualquer momento. Um orçamento perdido ou um serviço mal registado costuma custar mais do que a mensalidade." },
  { q: "Tenho uma oficina pequena.", a: "O plano de entrada existe exatamente para isso: clientes, viaturas, orçamentos, serviços e faturação, sem funcionalidades a mais." },
  { q: "Não quero mudar agora.", a: "Pode começar apenas pelos orçamentos e serviços novos. Os dados antigos podem ser importados mais tarde, sem parar a oficina." },
  { q: "Tenho receio dos dados.", a: "Os dados ficam isolados por oficina, com controlo de acessos por utilizador e por função. Pode exportar os seus dados a qualquer momento." },
  { q: "Quero experimentar primeiro.", a: "Há período de experiência e esta demonstração usa um ambiente com dados fictícios. Pode testar o fluxo completo antes de decidir." },
];

const STORAGE_KEY = "garageflow_sales_demo_state";

/* ------------------------------------------------------- recommendation */

type PlanSlug = "free" | "pro" | "garage";
const PLAN_LABEL: Record<PlanSlug, string> = { free: "Start", pro: "Pro", garage: "Garage" };
const ORDER: PlanSlug[] = ["free", "pro", "garage"];

function usersCount(a: Answers): number {
  switch (a.users) {
    case "1": return 1;
    case "2-5": return 5;
    case "6-10": return 10;
    case "11+": return 15;
    default: return 1;
  }
}
function volumeCount(a: Answers): number {
  switch (a.vehicles) {
    case "1-25": return 25;
    case "26-50": return 50;
    case "51-100": return 100;
    case "100+": return 150;
    default: return 0;
  }
}

function recommend(a: Answers, s: PlatformSettings) {
  const u = usersCount(a);
  const vol = volumeCount(a);
  const reasons: string[] = [];
  let min: PlanSlug = "free";

  if (u > s.planLimits.proUserLimit) {
    min = "garage";
    reasons.push(`Indicou ${a.users} utilizadores — acima do limite de ${s.planLimits.proUserLimit} do plano Pro.`);
  } else if (u > s.planLimits.freeUserLimit) {
    min = "pro";
    reasons.push(`Indicou ${a.users} utilizadores — o plano ${PLAN_LABEL.free} permite ${s.planLimits.freeUserLimit}.`);
  }

  if (vol > s.planLimits.freeQuoteLimit && min === "free") {
    min = "pro";
    reasons.push(`Cerca de ${a.vehicles} viaturas/mês ultrapassa o limite de ${s.planLimits.freeQuoteLimit} orçamentos/mês do plano ${PLAN_LABEL.free}.`);
  }

  const painNeedsPro = ["Comunicação com clientes", "Orçamentos", "Relatórios"];
  if (painNeedsPro.includes(a.pain || "") && min === "free") {
    min = "pro";
    reasons.push(`A dificuldade indicada (${a.pain}) resolve-se com funcionalidades incluídas no Pro (aprovação de orçamentos, portal do cliente e relatórios).`);
  }
  if (a.team === "11+" && min !== "garage") {
    min = "garage";
    reasons.push("Equipa com 11+ pessoas beneficia de gestão de equipa alargada e multi-oficina.");
  }

  if (reasons.length === 0) {
    reasons.push(`Volume e utilizadores indicados cabem nos limites do plano ${PLAN_LABEL.free} (${s.planLimits.freeQuoteLimit} orçamentos/mês, ${s.planLimits.freeUserLimit} utilizador).`);
    reasons.push("Não faz sentido pagar por funcionalidades que hoje não vai usar.");
  }

  const recommended = min;
  const idx = ORDER.indexOf(recommended);
  const below = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx < 2 ? ORDER[idx + 1] : null;
  return { min, recommended, below, next, reasons: reasons.slice(0, 4) };
}

/* --------------------------------------------------------------- helpers */

function Pill({ active, children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm border transition-colors min-h-11 ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ component */

export default function SalesDemo() {
  const { pricing, formatPrice } = useCountryPricing();
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [phase, setPhase] = useState<Phase>("home");
  const [answers, setAnswers] = useState<Answers>({});
  const [mode, setMode] = useState<"express" | "full">("express");
  const [stepIdx, setStepIdx] = useState(0);
  const [seen, setSeen] = useState<StepKey[]>([]);
  const [showScript, setShowScript] = useState(true);
  const [presentation, setPresentation] = useState(false);
  const [compareMode, setCompareMode] = useState<"all" | "free-pro" | "pro-garage" | "locked" | "relevant">("all");

  useEffect(() => { loadPlatformSettings().then(setSettings).catch(() => {}); }, []);

  // Persist only the demo layer state (never credentials/data).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setAnswers(p.answers || {});
        setMode(p.mode || "express");
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, mode })); } catch { /* ignore */ }
  }, [answers, mode]);

  const steps = useMemo(
    () => adaptOrder(mode === "express" ? EXPRESS : FULL, answers.pain),
    [mode, answers.pain],
  );
  const current = steps[Math.min(stepIdx, steps.length - 1)];
  const rec = useMemo(() => recommend(answers, settings), [answers, settings]);

  useEffect(() => {
    if (phase === "run" && current) setSeen((s) => (s.includes(current) ? s : [...s, current]));
  }, [phase, current]);

  const planPrice = (slug: PlanSlug) =>
    slug === "free" ? formatPrice(0)
      : slug === "pro" ? formatPrice(pricing.saas_pro_monthly)
      : formatPrice(pricing.saas_garage_monthly);

  const planFeatures = (slug: PlanSlug) =>
    slug === "free" ? settings.featureGates.freeFeatures
      : slug === "pro" ? settings.featureGates.proFeatures
      : settings.featureGates.garageFeatures;

  const FEATURE_LABEL: Record<string, string> = {
    quotes: "Orçamentos", work_orders: "Serviços / reparações", clients: "Clientes",
    invoices: "Faturação", service_catalog: "Catálogo de serviços", alerts_basic: "Alertas",
    alerts_advanced: "Alertas avançados", team: "Gestão de equipa", agenda: "Agenda",
    reports_basic: "Relatórios", reports_advanced: "Relatórios avançados", csv_export: "Exportação CSV",
    quote_approval: "Aprovação digital de orçamentos", client_portal: "Portal do cliente",
    stock: "Stock / peças", inspections: "Inspeções digitais", chat: "Chat interno",
    marketing: "Marketing", loyalty: "Fidelização", multi_shop: "Multi-oficina",
    api: "API", automations: "Automações",
  };
  const label = (k: string) => FEATURE_LABEL[k] || k;

  const relevantKeys = useMemo(() => {
    const map: Record<string, string[]> = {
      "Orçamentos": ["quotes", "quote_approval", "client_portal"],
      "Histórico das viaturas": ["work_orders", "clients"],
      "Organização": ["work_orders", "agenda", "team"],
      "Comunicação com clientes": ["client_portal", "alerts_basic", "chat"],
      "Gestão da reparação": ["work_orders", "stock", "inspections"],
      "Faturação": ["invoices", "csv_export"],
      "Relatórios": ["reports_basic", "reports_advanced"],
    };
    return map[answers.pain || ""] || [];
  }, [answers.pain]);

  const compareRows = useMemo(() => {
    const all = Array.from(new Set([...planFeatures("free"), ...planFeatures("pro"), ...planFeatures("garage")]));
    const f = planFeatures("free"), p = planFeatures("pro"), g = planFeatures("garage");
    return all
      .filter((k) => {
        if (compareMode === "free-pro") return p.includes(k) && !f.includes(k);
        if (compareMode === "pro-garage") return g.includes(k) && !p.includes(k);
        if (compareMode === "locked") return !f.includes(k);
        if (compareMode === "relevant") return relevantKeys.length ? relevantKeys.includes(k) : true;
        return true;
      })
      .map((k) => ({ key: k, free: f.includes(k), pro: p.includes(k), garage: g.includes(k) }));
  }, [compareMode, settings, relevantKeys]);

  const resetDemo = () => {
    setPhase("home"); setAnswers({}); setStepIdx(0); setSeen([]);
    setMode("express"); setPresentation(false); setShowScript(true); setCompareMode("all");
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.success("Demonstração reiniciada");
  };

  const summaryText = () => {
    const lines = [
      "RESUMO DA DEMONSTRAÇÃO — GarageFlow",
      `Perfil: ${answers.profile || "—"}`,
      `Equipa: ${answers.team || "—"} | Viaturas/mês: ${answers.vehicles || "—"} | Utilizadores: ${answers.users || "—"}`,
      `Software atual: ${answers.software === "sim" ? "Sim" : answers.software === "nao" ? "Não" : "—"}`,
      `Maior dificuldade: ${answers.pain || "—"}`,
      `Demonstrado: ${seen.map((s) => STEP_META[s].label).join(", ") || "—"}`,
      `Plano mínimo: ${PLAN_LABEL[rec.min]}`,
      `Plano recomendado: ${PLAN_LABEL[rec.recommended]} (${planPrice(rec.recommended)}/mês)`,
      `Plano seguinte: ${rec.next ? PLAN_LABEL[rec.next] : "—"}`,
      "Próximo passo: criar conta e importar clientes/viaturas.",
    ];
    return lines.join("\n");
  };

  /* ------------------------------------------------------------- render */

  const controller: { key: string; label: string; go: () => void }[] = [
    { key: "start", label: "Início", go: () => setPhase("home") },
    { key: "qual", label: "Qualificação", go: () => setPhase("qualify") },
    { key: "run", label: "Demonstração", go: () => setPhase("run") },
    { key: "plans", label: "Planos", go: () => setPhase("plans") },
    { key: "rec", label: "Recomendação", go: () => { setPhase("run"); setStepIdx(steps.indexOf("recommendation")); } },
    { key: "sum", label: "Resumo", go: () => setPhase("summary") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">
            Garage<span className="text-primary">Flow</span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">Sales Demo</span>
          </span>
          <Badge variant="outline" className="ml-1 text-[10px]">DEMO MODE</Badge>
          <div className="flex-1" />
          {!presentation && (
            <Button variant="ghost" size="sm" onClick={() => setShowScript((v) => !v)}>
              {showScript ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden md:inline ml-1">Guião</span>
            </Button>
          )}
          <Button variant={presentation ? "default" : "outline"} size="sm" onClick={() => setPresentation((v) => !v)}>
            <Presentation className="w-4 h-4" />
            <span className="hidden md:inline ml-1">Apresentação</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={resetDemo}>
            <RotateCcw className="w-4 h-4" /><span className="hidden md:inline ml-1">Reset</span>
          </Button>
        </div>
      </header>

      {/* Demo controller */}
      {!presentation && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            {controller.map((c) => (
              <button key={c.key} onClick={c.go}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent whitespace-nowrap">
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* HOME */}
        {phase === "home" && (
          <section className="text-center py-10 space-y-6">
            <Badge variant="outline" className="mx-auto">🎯 Sales Demo</Badge>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Garage<span className="text-primary">Flow</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Veja em poucos minutos como o GarageFlow pode organizar a sua oficina.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => setPhase("qualify")}>
                <Rocket className="w-4 h-4 mr-2" /> Começar demonstração
              </Button>
              <Button size="lg" variant="outline" onClick={() => setPhase("plans")}>
                <BarChart3 className="w-4 h-4 mr-2" /> Comparar planos
              </Button>
              <Button size="lg" variant="outline" onClick={() => { setPhase("run"); setStepIdx(steps.indexOf("recommendation")); }}>
                <Target className="w-4 h-4 mr-2" /> Encontrar o plano ideal
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-6">Ambiente de demonstração — dados fictícios.</p>
          </section>
        )}

        {/* QUALIFY */}
        {phase === "qualify" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Vamos adaptar a demonstração à sua oficina.</h2>
            <p className="text-sm text-muted-foreground">Todas as perguntas são opcionais.</p>

            {[
              { k: "team", q: "Quantas pessoas trabalham na oficina?", opts: ["1", "2-5", "6-10", "11+"] },
              { k: "vehicles", q: "Quantas viaturas tratam aproximadamente por mês?", opts: ["1-25", "26-50", "51-100", "100+"] },
              { k: "users", q: "Quantos utilizadores precisam do sistema?", opts: ["1", "2-5", "6-10", "11+"] },
              { k: "software", q: "Utilizam atualmente algum software?", opts: ["nao", "sim"] },
              { k: "pain", q: "Qual é a maior dificuldade atualmente?", opts: ["Organização", "Orçamentos", "Comunicação com clientes", "Histórico das viaturas", "Gestão da reparação", "Faturação", "Relatórios", "Outro"] },
            ].map((row) => (
              <Card key={row.k}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{row.q}</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {row.opts.map((o) => (
                    <Pill key={o} active={(answers as any)[row.k] === o}
                      onClick={() => setAnswers((a) => ({ ...a, [row.k]: o }))}>
                      {o === "nao" ? "Não" : o === "sim" ? "Sim" : o}
                    </Pill>
                  ))}
                </CardContent>
              </Card>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setPhase("profile")}>Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button>
              <Button variant="ghost" onClick={() => { setPhase("run"); setStepIdx(0); }}>Saltar e começar Demo</Button>
            </div>
          </section>
        )}

        {/* PROFILE */}
        {phase === "profile" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Escolha o perfil da oficina</h2>
            <p className="text-sm text-muted-foreground">Serve apenas para organizar a apresentação.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {["🔧 Oficina Pequena", "🚗 Oficina em Crescimento", "🏢 Oficina com Equipa", "🏭 Oficina de Maior Dimensão"].map((p) => (
                <Card key={p} onClick={() => setAnswers((a) => ({ ...a, profile: p }))}
                  className={`cursor-pointer transition-colors ${answers.profile === p ? "border-primary" : "hover:border-primary/40"}`}>
                  <CardContent className="p-5 font-medium">{p}</CardContent>
                </Card>
              ))}
            </div>
            <Button onClick={() => setPhase("mode")}>Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </section>
        )}

        {/* MODE */}
        {phase === "mode" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Que demonstração quer fazer?</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary/60" onClick={() => { setMode("express"); setStepIdx(0); setPhase("run"); }}>
                <CardHeader><CardTitle>⚡ Demo Express</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  ~5 minutos · {EXPRESS.length} etapas · Dashboard → Viatura → Orçamento → Reparação → Planos → Recomendação → Conversão
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-primary/60" onClick={() => { setMode("full"); setStepIdx(0); setPhase("run"); }}>
                <CardHeader><CardTitle>🎯 Demo Completa</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  ~10 minutos · {FULL.length} etapas · percurso completo do cliente à faturação e métricas
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* RUN */}
        {phase === "run" && current && (
          <section className="space-y-5">
            {/* progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Demonstração {stepIdx + 1}/{steps.length}</span>
                <span className="text-muted-foreground">{mode === "express" ? "Express" : "Completa"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {steps.map((s, i) => (
                  <button key={s} onClick={() => setStepIdx(i)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${
                      i === stepIdx ? "bg-primary text-primary-foreground border-primary"
                        : seen.includes(s) ? "bg-primary/10 border-primary/30" : "bg-card border-border"
                    }`}>
                    {STEP_META[s].label}
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader className="flex-row items-center gap-3">
                {(() => { const I = STEP_META[current].icon; return <I className="w-5 h-5 text-primary" />; })()}
                <CardTitle>{STEP_META[current].label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> 💡 O valor aqui</p>
                  <p className="text-sm text-muted-foreground mt-1">{STEP_META[current].value}</p>
                </div>

                {showScript && !presentation && (
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm font-semibold flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Sugestão para o comercial</p>
                    <p className="text-sm text-muted-foreground mt-1">{STEP_META[current].script}</p>
                  </div>
                )}

                {STEP_META[current].link && (
                  <Button asChild variant="outline">
                    <a href={STEP_META[current].link} target="_blank" rel="noreferrer">
                      Abrir {STEP_META[current].label} na conta Demo <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                )}

                {current === "plans" && <PlansGrid planPrice={planPrice} planFeatures={planFeatures} label={label} />}

                {current === "compare" && (
                  <p className="text-sm text-muted-foreground">
                    Abra a área <button className="underline" onClick={() => setPhase("plans")}>Comparação inteligente</button> para ver apenas as diferenças relevantes.
                  </p>
                )}

                {current === "recommendation" && <Recommendation rec={rec} planPrice={planPrice} planFeatures={planFeatures} label={label} />}

                {current === "conversion" && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold">🚀 Pronto para começar?</h3>
                    <div className="flex flex-wrap gap-3">
                      <Button asChild><Link to="/auth">Criar conta e começar</Link></Button>
                      <Button asChild variant="outline"><Link to="/demo">Pedir acompanhamento</Link></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              {stepIdx < steps.length - 1 ? (
                <Button onClick={() => setStepIdx((i) => i + 1)}>Seguinte <ChevronRight className="w-4 h-4 ml-1" /></Button>
              ) : (
                <Button onClick={() => setPhase("summary")}>Ver resumo <ChevronRight className="w-4 h-4 ml-1" /></Button>
              )}
            </div>

            {/* Shortcuts + value recap */}
            {!presentation && (
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Atalhos da conta Demo</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {[
                      { l: "⭐ Cliente Demo", to: "/clients" },
                      { l: "⭐ Viatura Demo", to: "/vehicles" },
                      { l: "⭐ Orçamento Demo", to: "/quotes" },
                      { l: "⭐ Reparação Demo", to: "/services" },
                    ].map((s) => (
                      <Button key={s.to} asChild size="sm" variant="outline">
                        <a href={s.to} target="_blank" rel="noreferrer">{s.l}</a>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Hoje vimos</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2 text-sm">
                    {seen.length === 0 && <span className="text-muted-foreground">Ainda nada demonstrado.</span>}
                    {seen.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary" />{STEP_META[s].label}
                      </span>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        )}

        {/* PLANS + COMPARE + OBJECTIONS */}
        {phase === "plans" && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">📊 {PLAN_LABEL.free} vs Pro vs Garage</h2>
            <PlansGrid planPrice={planPrice} planFeatures={planFeatures} label={label} />

            <div className="space-y-3">
              <h3 className="font-semibold">Comparação inteligente</h3>
              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "Mostrar tudo"],
                  ["free-pro", `${PLAN_LABEL.free} → Pro`],
                  ["pro-garage", "Pro → Garage"],
                  ["locked", "Apenas funcionalidades bloqueadas"],
                  ["relevant", "Apenas relevantes para esta oficina"],
                ] as const).map(([k, l]) => (
                  <Pill key={k} active={compareMode === k} onClick={() => setCompareMode(k as any)}>{l}</Pill>
                ))}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">Funcionalidade</th>
                      <th className="p-3">{PLAN_LABEL.free}</th><th className="p-3">Pro</th><th className="p-3">Garage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r) => (
                      <tr key={r.key} className="border-t border-border">
                        <td className="p-3">{label(r.key)}</td>
                        {[r.free, r.pro, r.garage].map((v, i) => (
                          <td key={i} className="p-3 text-center">
                            {v ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {compareRows.length === 0 && (
                      <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sem diferenças relevantes.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <Recommendation rec={rec} planPrice={planPrice} planFeatures={planFeatures} label={label} />

            {!presentation && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><MessageSquareWarning className="w-4 h-4" /> 💬 Objeções</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {OBJECTIONS.map((o) => (
                    <Card key={o.q}>
                      <CardContent className="p-4 space-y-1">
                        <p className="font-medium text-sm">{o.q}</p>
                        <p className="text-sm text-muted-foreground">{o.a}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* SUMMARY */}
        {phase === "summary" && (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">📋 Resumo da demonstração</h2>
            <Card>
              <CardContent className="p-5 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Perfil:</span> {answers.profile || "—"}</p>
                <p><span className="text-muted-foreground">Necessidade principal:</span> {answers.pain || "—"}</p>
                <p><span className="text-muted-foreground">Equipa / viaturas / utilizadores:</span> {answers.team || "—"} · {answers.vehicles || "—"} · {answers.users || "—"}</p>
                <p><span className="text-muted-foreground">Funcionalidades demonstradas:</span> {seen.map((s) => STEP_META[s].label).join(", ") || "—"}</p>
                <p><span className="text-muted-foreground">Plano mínimo:</span> {PLAN_LABEL[rec.min]}</p>
                <p><span className="text-muted-foreground">Plano recomendado:</span> <strong>{PLAN_LABEL[rec.recommended]}</strong> — {planPrice(rec.recommended)}/mês</p>
                <p><span className="text-muted-foreground">Plano seguinte:</span> {rec.next ? PLAN_LABEL[rec.next] : "—"}</p>
                <p><span className="text-muted-foreground">Próximo passo:</span> criar conta e importar clientes/viaturas.</p>
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(summaryText()); toast.success("Resumo copiado"); }}>
                <ClipboardCopy className="w-4 h-4 mr-2" /> Copiar resumo
              </Button>
              <Button asChild><Link to="/auth">🚀 Começar agora</Link></Button>
              <Button variant="ghost" onClick={resetDemo}><RotateCcw className="w-4 h-4 mr-2" /> Reset Demo</Button>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground pt-6">
          Ambiente de demonstração — dados fictícios. Emails, WhatsApp e SMS são simulados nesta apresentação.
        </p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ subviews */

function PlansGrid({ planPrice, planFeatures, label }: any) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {(["free", "pro", "garage"] as PlanSlug[]).map((slug) => (
        <Card key={slug} className={slug === "pro" ? "border-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-baseline justify-between">
              <span>{PLAN_LABEL[slug]}</span>
              <span className="text-sm font-semibold text-primary">{planPrice(slug)}<span className="text-muted-foreground font-normal">/mês</span></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {planFeatures(slug).map((f: string) => (
              <p key={f} className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />{label(f)}
              </p>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Recommendation({ rec, planPrice, planFeatures, label }: any) {
  const below = rec.below as PlanSlug | null;
  const next = rec.next as PlanSlug | null;
  const recommended = rec.recommended as PlanSlug;
  const diff = (a: PlanSlug, b: PlanSlug) =>
    planFeatures(b).filter((k: string) => !planFeatures(a).includes(k)).slice(0, 5);

  return (
    <div className="space-y-4">
      <Card className="border-primary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">🎯 Plano recomendado: {PLAN_LABEL[recommended]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-primary font-semibold">{planPrice(recommended)}/mês</p>
          <div>
            <p className="font-medium">Porque recomendamos este plano?</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {rec.reasons.map((r: string, i: number) => (
                <li key={i} className="flex gap-2"><Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />{r}</li>
              ))}
            </ul>
          </div>
          {below && (
            <div>
              <p className="font-medium">Porque não o plano inferior ({PLAN_LABEL[below]})?</p>
              <p className="text-muted-foreground">
                Ficaria sem: {diff(below, recommended).map(label).join(", ") || "limites suficientes para o volume indicado"}.
              </p>
            </div>
          )}
          {next && (
            <div>
              <p className="font-medium">Quando faria sentido o plano superior ({PLAN_LABEL[next]})?</p>
              <p className="text-muted-foreground">
                Quando precisar de: {diff(recommended, next).map(label).join(", ") || "mais utilizadores e mais oficinas"}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
