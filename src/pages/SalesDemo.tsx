/**
 * GARAGEFLOW SALES DEMO PRO — /demo-demonstracao
 *
 * Camada de apresentação comercial 100% isolada. NÃO altera nada do ERP:
 * lê apenas preços reais (country_settings) e limites reais (platform_settings)
 * e faz deep-link para as páginas existentes. Nenhuma credencial aqui.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Rocket, BarChart3, Target, Check, ChevronRight, ChevronLeft, RotateCcw,
  Eye, EyeOff, Presentation, Lightbulb, MessageSquareWarning, ClipboardCopy,
  Users, Car, FileText, Wrench, LayoutDashboard, Package, ListChecks,
  History, Sparkles, ExternalLink, Star, Menu, X, Zap, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCountryPricing } from "@/hooks/useCountryPricing";
import { loadPlatformSettings, DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/platformSettings";
import { DemoStage } from "@/components/salesdemo/DemoStage";
import { toast } from "sonner";

/* ----------------------------------------------------------------- types */

type Answers = {
  team?: string; vehicles?: string; users?: string; software?: string;
  pain?: string; profile?: string;
};
type Phase = "home" | "qualify" | "run" | "plans" | "objections" | "summary";
type StepKey =
  | "dashboard" | "client" | "vehicle" | "history" | "quote" | "parts"
  | "services" | "repair" | "tasks" | "metrics" | "plans" | "recommendation" | "conversion";

const STEP_META: Record<StepKey, { label: string; icon: any; link?: string; script: string; value: string }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard, link: "/dashboard",
    script: "Aqui consegue perceber rapidamente o que está a acontecer na oficina.",
    value: "Estado da oficina num só ecrã: serviços em curso, orçamentos por aprovar e faturação do mês." },
  client: { label: "Cliente", icon: Users, link: "/clients",
    script: "Este é o cliente. Viaturas, orçamentos e comunicação ficam ligados a esta ficha.",
    value: "Cada cliente tem viaturas, orçamentos e serviços associados — sem folhas soltas." },
  vehicle: { label: "Viatura", icon: Car, link: "/vehicles",
    script: "Aqui fica centralizado o histórico desta viatura.",
    value: "Toda a informação desta viatura fica centralizada." },
  history: { label: "Histórico", icon: History, link: "/vehicles",
    script: "Consegue ver tudo o que já foi feito nesta viatura, e quando.",
    value: "O histórico acompanha a viatura, mesmo que mude o técnico responsável." },
  quote: { label: "Orçamento", icon: FileText, link: "/quotes",
    script: "Agora vamos transformar este trabalho num orçamento.",
    value: "O orçamento sai em PDF e pode ser aprovado digitalmente pelo cliente." },
  parts: { label: "Peças", icon: Package, link: "/stock",
    script: "As peças usadas no trabalho saem do stock automaticamente.",
    value: "Stock e custo real do trabalho ficam ligados à reparação." },
  services: { label: "Serviços", icon: Wrench, link: "/services",
    script: "Esta é a lista de trabalhos da oficina, com o estado de cada um.",
    value: "A equipa consegue acompanhar o estado do trabalho." },
  repair: { label: "Reparação", icon: Wrench, link: "/services",
    script: "Depois da aprovação, o trabalho passa para a reparação.",
    value: "O orçamento e a reparação ficam ligados ao histórico da viatura." },
  tasks: { label: "Tarefas", icon: ListChecks, link: "/workshop",
    script: "No modo oficina, cada técnico vê o que tem para fazer.",
    value: "Menos perguntas na oficina: o trabalho está atribuído e visível." },
  metrics: { label: "Métricas", icon: BarChart3, link: "/reports/financial",
    script: "E aqui vê os números: faturação, serviços e evolução.",
    value: "Decisões com base em números reais da oficina, não em memória." },
  plans: { label: "Planos", icon: BarChart3,
    script: "Agora vamos ver o que muda entre os diferentes níveis.",
    value: "Paga apenas pelo que precisa hoje — pode subir a qualquer momento." },
  recommendation: { label: "Recomendação", icon: Target,
    script: "Com base no que me disse, este é o plano mais adequado.",
    value: "Recomendamos o plano adequado, não o mais caro." },
  conversion: { label: "Conversão", icon: Rocket,
    script: "Podemos começar hoje mesmo, com os seus dados.",
    value: "Arranque rápido: criar conta, importar dados e começar no mesmo dia." },
};

const EXPRESS: StepKey[] = ["dashboard", "vehicle", "quote", "repair", "plans", "recommendation", "conversion"];
const FULL: StepKey[] = ["dashboard", "client", "vehicle", "history", "quote", "parts", "services", "repair", "tasks", "metrics", "plans", "recommendation", "conversion"];

function adaptOrder(base: StepKey[], pain?: string): StepKey[] {
  const priority: Record<string, StepKey[]> = {
    "Orçamentos": ["client", "vehicle", "quote", "repair"],
    "Histórico das viaturas": ["client", "vehicle", "history"],
    "Organização": ["dashboard", "tasks", "repair", "metrics"],
    "Gestão da reparação": ["dashboard", "repair", "services"],
    "Relatórios": ["dashboard", "metrics"],
    "Faturação": ["quote", "repair", "metrics"],
    "Comunicação com clientes": ["client", "quote", "repair"],
  };
  const first = (priority[pain || ""] || []).filter((s) => base.includes(s));
  return [...first, ...base.filter((s) => !first.includes(s))];
}

const OBJECTIONS = [
  { q: "Já tenho um sistema.", a: "Sem problema. Pode importar clientes e viaturas a partir de Excel/CSV e o histórico fica associado às viaturas. Durante o período de experiência pode correr em paralelo com o sistema atual." },
  { q: "É caro.", a: "Só paga o plano de que precisa e pode mudar a qualquer momento. Um orçamento perdido ou um serviço mal registado costuma custar mais do que a mensalidade." },
  { q: "Tenho uma oficina pequena.", a: "O plano de entrada existe exatamente para isso: clientes, viaturas, orçamentos, serviços e faturação, sem funcionalidades a mais." },
  { q: "Não quero mudar agora.", a: "Pode começar apenas pelos orçamentos e serviços novos. Os dados antigos podem ser importados mais tarde, sem parar a oficina." },
  { q: "Tenho receio dos dados.", a: "Os dados ficam isolados por oficina, com acessos por utilizador e por função. Pode exportar os seus dados a qualquer momento." },
  { q: "Quero experimentar primeiro.", a: "Existe período de experiência e esta demonstração corre num ambiente com dados fictícios. Pode testar o fluxo completo antes de decidir." },
];

const STORAGE_KEY = "garageflow_sales_demo_state";

/* -------------------------------------------------------- recommendation */

type PlanSlug = "free" | "pro" | "garage";
const PLAN_LABEL: Record<PlanSlug, string> = { free: "Start", pro: "Pro", garage: "Garage" };
const ORDER: PlanSlug[] = ["free", "pro", "garage"];

const usersCount = (a: Answers) => ({ "1": 1, "2-5": 5, "6-10": 10, "11+": 15 }[a.users || ""] ?? 1);
const volumeCount = (a: Answers) => ({ "1-25": 25, "26-50": 50, "51-100": 100, "100+": 150 }[a.vehicles || ""] ?? 0);

function recommend(a: Answers, s: PlatformSettings) {
  const u = usersCount(a), vol = volumeCount(a);
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
  if (["Comunicação com clientes", "Orçamentos", "Relatórios"].includes(a.pain || "") && min === "free") {
    min = "pro";
    reasons.push(`A dificuldade indicada (${a.pain}) resolve-se com funcionalidades incluídas no Pro: aprovação digital de orçamentos, portal do cliente e relatórios.`);
  }
  if (a.team === "11+" && min !== "garage") {
    min = "garage";
    reasons.push("Equipa com 11+ pessoas beneficia de gestão de equipa alargada e multi-oficina.");
  }
  if (reasons.length === 0) {
    reasons.push(`Volume e utilizadores indicados cabem nos limites do plano ${PLAN_LABEL.free} (${s.planLimits.freeQuoteLimit} orçamentos/mês, ${s.planLimits.freeUserLimit} utilizador).`);
    reasons.push("Não faz sentido pagar por funcionalidades que hoje não vai usar.");
  }
  const idx = ORDER.indexOf(min);
  return { min, recommended: min, below: idx > 0 ? ORDER[idx - 1] : null, next: idx < 2 ? ORDER[idx + 1] : null, reasons: reasons.slice(0, 4) };
}

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

function Pill({ active, children, onClick }: any) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm border transition-colors min-h-11 ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- component */

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
  const [railOpen, setRailOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<"all" | "free-pro" | "pro-garage" | "locked" | "relevant">("all");

  useEffect(() => { loadPlatformSettings().then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const p = JSON.parse(raw); setAnswers(p.answers || {}); setMode(p.mode || "express"); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, mode })); } catch { /* ignore */ }
  }, [answers, mode]);

  const steps = useMemo(() => adaptOrder(mode === "express" ? EXPRESS : FULL, answers.pain), [mode, answers.pain]);
  const current = steps[Math.min(stepIdx, steps.length - 1)];
  const rec = useMemo(() => recommend(answers, settings), [answers, settings]);

  useEffect(() => {
    if (phase === "run" && current) setSeen((s) => (s.includes(current) ? s : [...s, current]));
  }, [phase, current]);

  const planPrice = (slug: PlanSlug) =>
    slug === "free" ? formatPrice(0) : slug === "pro" ? formatPrice(pricing.saas_pro_monthly) : formatPrice(pricing.saas_garage_monthly);
  const planFeatures = (slug: PlanSlug) =>
    slug === "free" ? settings.featureGates.freeFeatures : slug === "pro" ? settings.featureGates.proFeatures : settings.featureGates.garageFeatures;

  const relevantKeys = useMemo(() => ({
    "Orçamentos": ["quotes", "quote_approval", "client_portal"],
    "Histórico das viaturas": ["work_orders", "clients"],
    "Organização": ["work_orders", "agenda", "team"],
    "Comunicação com clientes": ["client_portal", "alerts_basic", "chat"],
    "Gestão da reparação": ["work_orders", "stock", "inspections"],
    "Faturação": ["invoices", "csv_export"],
    "Relatórios": ["reports_basic", "reports_advanced"],
  } as Record<string, string[]>)[answers.pain || ""] || [], [answers.pain]);

  const compareRows = useMemo(() => {
    const f = planFeatures("free"), p = planFeatures("pro"), g = planFeatures("garage");
    const all = Array.from(new Set([...f, ...p, ...g]));
    return all.filter((k) => {
      if (compareMode === "free-pro") return p.includes(k) && !f.includes(k);
      if (compareMode === "pro-garage") return g.includes(k) && !p.includes(k);
      if (compareMode === "locked") return !f.includes(k);
      if (compareMode === "relevant") return relevantKeys.length ? relevantKeys.includes(k) : true;
      return true;
    }).map((k) => ({ key: k, free: f.includes(k), pro: p.includes(k), garage: g.includes(k) }));
  }, [compareMode, settings, relevantKeys]);

  const startDemo = (m: "express" | "full") => { setMode(m); setStepIdx(0); setPhase("run"); setRailOpen(false); };

  const resetDemo = () => {
    setPhase("home"); setAnswers({}); setStepIdx(0); setSeen([]); setMode("express");
    setPresentation(false); setShowScript(true); setCompareMode("all");
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.success("Demonstração reiniciada");
  };

  const summaryText = () => [
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
  ].join("\n");

  const answered = Object.values(answers).filter(Boolean).length;

  /* --------------------------------------------------------------- rail */

  const Rail = (
    <nav className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 mb-2">Demo Controller</p>
        <div className="space-y-1">
          {[
            { l: "Início", on: phase === "home", go: () => setPhase("home") },
            { l: "Qualificação", on: phase === "qualify", go: () => setPhase("qualify") },
            { l: "Demonstração", on: phase === "run", go: () => setPhase("run") },
            { l: "Planos e comparação", on: phase === "plans", go: () => setPhase("plans") },
            { l: "Objeções", on: phase === "objections", go: () => setPhase("objections") },
            { l: "Resumo e CTA", on: phase === "summary", go: () => setPhase("summary") },
          ].map((i) => (
            <button key={i.l} onClick={() => { i.go(); setRailOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                i.on ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent text-muted-foreground"}`}>
              {i.l}
            </button>
          ))}
        </div>
      </div>

      {phase === "run" && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 mb-2">
            Etapas · {stepIdx + 1}/{steps.length}
          </p>
          <div className="space-y-1">
            {steps.map((s, i) => {
              const I = STEP_META[s].icon;
              return (
                <button key={s} onClick={() => { setStepIdx(i); setRailOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    i === stepIdx ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60"}`}>
                  <I className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{STEP_META[s].label}</span>
                  {seen.includes(s) && i !== stepIdx && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!presentation && phase === "run" && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 mb-2">Saltar para</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["client", "vehicle", "quote", "repair"] as StepKey[]).filter((k) => steps.includes(k)).map((k) => (
              <button key={k} onClick={() => { setStepIdx(steps.indexOf(k)); setRailOpen(false); }}
                className="text-xs px-2 py-2 rounded-lg border border-border hover:bg-accent text-center">
                ⭐ {STEP_META[k].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );

  /* ------------------------------------------------------------- render */

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-2">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent" onClick={() => setRailOpen(true)} aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">
            Garage<span className="text-primary">Flow</span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">Sales Demo</span>
          </span>
          <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">DEMO · sem login</Badge>
          <div className="flex-1" />
          {!presentation && (
            <Button variant="ghost" size="sm" onClick={() => setShowScript((v) => !v)}>
              {showScript ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden md:inline ml-1">Guião</span>
            </Button>
          )}
          <Button variant={presentation ? "default" : "outline"} size="sm" onClick={() => setPresentation((v) => !v)}>
            <Presentation className="w-4 h-4" /><span className="hidden md:inline ml-1">Apresentação</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={resetDemo}>
            <RotateCcw className="w-4 h-4" /><span className="hidden md:inline ml-1">Reset</span>
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Rail desktop */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-border p-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          {Rail}
        </aside>
        {/* Rail mobile */}
        {railOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setRailOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border p-4 overflow-y-auto lg:hidden">
              <div className="flex justify-end mb-2">
                <button onClick={() => setRailOpen(false)} className="p-2 rounded-lg hover:bg-accent"><X className="w-5 h-5" /></button>
              </div>
              {Rail}
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0 px-4 py-6 lg:py-8 space-y-6">
          {/* HOME */}
          {phase === "home" && (
            <section className="space-y-8">
              <div className="rounded-2xl border border-border gradient-dark p-8 sm:p-12 text-center space-y-5">
                <Badge variant="outline" className="mx-auto">🎯 Sales Demo Pro</Badge>
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
                  Mostre a oficina organizada em <span className="text-primary">5 minutos</span>
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Percurso guiado: dashboard, viatura, orçamento, reparação, planos e recomendação — com guião para o comercial e dados fictícios.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button size="lg" onClick={() => setPhase("qualify")}>
                    <Rocket className="w-4 h-4 mr-2" /> Começar demonstração
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setPhase("plans")}>
                    <BarChart3 className="w-4 h-4 mr-2" /> Comparar planos
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setPhase("summary")}>
                    <Target className="w-4 h-4 mr-2" /> Encontrar o plano ideal
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Ambiente de demonstração — dados fictícios (AutoPrime Lisboa).</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="hover:border-primary/60 transition-colors cursor-pointer" onClick={() => startDemo("express")}>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Demo Express</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p className="flex items-center gap-2"><Timer className="w-4 h-4" /> ~5 min · {EXPRESS.length} etapas</p>
                    <p>Dashboard → Viatura → Orçamento → Reparação → Planos → Recomendação → Conversão</p>
                  </CardContent>
                </Card>
                <Card className="hover:border-primary/60 transition-colors cursor-pointer" onClick={() => startDemo("full")}>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Demo Completa</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p className="flex items-center gap-2"><Timer className="w-4 h-4" /> ~10 min · {FULL.length} etapas</p>
                    <p>Percurso completo: cliente, histórico, peças, tarefas, métricas e planos.</p>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}

          {/* QUALIFY */}
          {phase === "qualify" && (
            <section className="space-y-5 max-w-3xl">
              <div>
                <h2 className="text-2xl font-bold">Vamos adaptar a demonstração à sua oficina.</h2>
                <p className="text-sm text-muted-foreground mt-1">Todas as perguntas são opcionais · {answered} respondidas</p>
              </div>
              {[
                { k: "team", q: "Quantas pessoas trabalham na oficina?", opts: ["1", "2-5", "6-10", "11+"] },
                { k: "vehicles", q: "Quantas viaturas tratam por mês?", opts: ["1-25", "26-50", "51-100", "100+"] },
                { k: "users", q: "Quantos utilizadores precisam do sistema?", opts: ["1", "2-5", "6-10", "11+"] },
                { k: "software", q: "Utilizam atualmente algum software?", opts: ["nao", "sim"] },
                { k: "pain", q: "Qual é a maior dificuldade atualmente?", opts: ["Organização", "Orçamentos", "Comunicação com clientes", "Histórico das viaturas", "Gestão da reparação", "Faturação", "Relatórios", "Outro"] },
                { k: "profile", q: "Perfil da oficina", opts: ["🔧 Pequena", "🚗 Em crescimento", "🏢 Com equipa", "🏭 Maior dimensão"] },
              ].map((row) => (
                <Card key={row.k}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{row.q}</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {row.opts.map((o) => (
                      <Pill key={o} active={(answers as any)[row.k] === o}
                        onClick={() => setAnswers((a) => ({ ...a, [row.k]: (a as any)[row.k] === o ? undefined : o }))}>
                        {o === "nao" ? "Não" : o === "sim" ? "Sim" : o}
                      </Pill>
                    ))}
                  </CardContent>
                </Card>
              ))}
              <div className="flex flex-wrap gap-3 sticky bottom-0 bg-background/90 backdrop-blur py-3">
                <Button onClick={() => startDemo("express")}><Zap className="w-4 h-4 mr-2" /> Demo Express (~5 min)</Button>
                <Button variant="outline" onClick={() => startDemo("full")}>Demo Completa (~10 min)</Button>
                <Button variant="ghost" onClick={() => startDemo("express")}>Saltar e começar Demo</Button>
              </div>
            </section>
          )}

          {/* RUN */}
          {phase === "run" && current && (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-semibold">Demonstração {stepIdx + 1}/{steps.length} · {STEP_META[current].label}</span>
                    <span className="text-muted-foreground hidden sm:inline">{mode === "express" ? "Express" : "Completa"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> O valor aqui</p>
                <p className="text-sm text-muted-foreground mt-1">{STEP_META[current].value}</p>
              </div>

              <DemoStage step={current} />

              {current === "plans" && <PlansGrid planPrice={planPrice} planFeatures={planFeatures} />}
              {current === "recommendation" && <Recommendation rec={rec} planPrice={planPrice} planFeatures={planFeatures} />}
              {current === "conversion" && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle>🚀 Pronto para começar?</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    <Button asChild><a href="/auth" target="_blank" rel="noreferrer">Criar conta da oficina <ExternalLink className="w-4 h-4 ml-1" /></a></Button>
                    <Button asChild variant="outline"><a href="/demo" target="_blank" rel="noreferrer">Pedir acompanhamento</a></Button>
                    <Button variant="ghost" onClick={() => setPhase("summary")}>Ver resumo da demonstração</Button>
                  </CardContent>
                </Card>
              )}

              {showScript && !presentation && (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-semibold flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Sugestão para o comercial</p>
                  <p className="text-sm text-muted-foreground mt-1">“{STEP_META[current].script}”</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                {stepIdx < steps.length - 1 ? (
                  <Button onClick={() => setStepIdx((i) => i + 1)}>Seguinte <ChevronRight className="w-4 h-4 ml-1" /></Button>
                ) : (
                  <Button onClick={() => setPhase("summary")}>Ver resumo <ChevronRight className="w-4 h-4 ml-1" /></Button>
                )}
                {!presentation && (
                  <Button variant="ghost" size="sm" onClick={resetDemo}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Nova demonstração
                  </Button>
                )}
              </div>

              {!presentation && seen.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Hoje vimos</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {seen.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-primary" />{STEP_META[s].label}</span>
                    ))}
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* PLANS */}
          {phase === "plans" && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold">📊 {PLAN_LABEL.free} vs Pro vs Garage</h2>
              <PlansGrid planPrice={planPrice} planFeatures={planFeatures} />

              <div className="space-y-3">
                <h3 className="font-semibold">Comparação inteligente</h3>
                <div className="flex flex-wrap gap-2">
                  {([["all", "Mostrar tudo"], ["free-pro", `${PLAN_LABEL.free} → Pro`], ["pro-garage", "Pro → Garage"],
                     ["locked", "Só bloqueadas no Start"], ["relevant", "Só relevantes para esta oficina"]] as const).map(([k, l]) => (
                    <Pill key={k} active={compareMode === k} onClick={() => setCompareMode(k as any)}>{l}</Pill>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-muted/50">
                      <tr><th className="text-left p-3">Funcionalidade</th><th className="p-3">{PLAN_LABEL.free}</th><th className="p-3">Pro</th><th className="p-3">Garage</th></tr>
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
                      {compareRows.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sem diferenças relevantes.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <Recommendation rec={rec} planPrice={planPrice} planFeatures={planFeatures} />
              <Button variant="outline" onClick={() => setPhase("objections")}>
                <MessageSquareWarning className="w-4 h-4 mr-2" /> Ver respostas a objeções
              </Button>
            </section>
          )}

          {/* OBJECTIONS */}
          {phase === "objections" && (
            <section className="space-y-4 max-w-3xl">
              <h2 className="text-2xl font-bold flex items-center gap-2"><MessageSquareWarning className="w-6 h-6 text-primary" /> Objeções</h2>
              <Accordion type="single" collapsible className="rounded-xl border border-border divide-y divide-border">
                {OBJECTIONS.map((o) => (
                  <AccordionItem key={o.q} value={o.q} className="border-0 px-4">
                    <AccordionTrigger className="text-left text-sm">{o.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{o.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Button onClick={() => setPhase("summary")}>Ir para o resumo <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </section>
          )}

          {/* SUMMARY */}
          {phase === "summary" && (
            <section className="space-y-5 max-w-3xl">
              <h2 className="text-2xl font-bold">📋 Resumo da demonstração</h2>
              <Card>
                <CardContent className="p-5 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Perfil:</span> {answers.profile || "—"}</p>
                  <p><span className="text-muted-foreground">Necessidade principal:</span> {answers.pain || "—"}</p>
                  <p><span className="text-muted-foreground">Equipa · viaturas/mês · utilizadores:</span> {answers.team || "—"} · {answers.vehicles || "—"} · {answers.users || "—"}</p>
                  <p><span className="text-muted-foreground">Demonstrado:</span> {seen.map((s) => STEP_META[s].label).join(", ") || "—"}</p>
                  <p><span className="text-muted-foreground">Plano mínimo:</span> {PLAN_LABEL[rec.min]}</p>
                  <p><span className="text-muted-foreground">Plano recomendado:</span> <strong>{PLAN_LABEL[rec.recommended]}</strong> — {planPrice(rec.recommended)}/mês</p>
                  <p><span className="text-muted-foreground">Plano seguinte:</span> {rec.next ? PLAN_LABEL[rec.next] : "—"}</p>
                  <p><span className="text-muted-foreground">Próximo passo:</span> criar conta e importar clientes/viaturas.</p>
                </CardContent>
              </Card>
              <Recommendation rec={rec} planPrice={planPrice} planFeatures={planFeatures} />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(summaryText()); toast.success("Resumo copiado"); }}>
                  <ClipboardCopy className="w-4 h-4 mr-2" /> Copiar resumo
                </Button>
                <Button asChild><a href="/auth" target="_blank" rel="noreferrer">🚀 Começar agora <ExternalLink className="w-4 h-4 ml-1" /></a></Button>
                <Button variant="ghost" onClick={resetDemo}><RotateCcw className="w-4 h-4 mr-2" /> Reset Demo · nova oficina</Button>
              </div>
            </section>
          )}

          <p className="text-center text-xs text-muted-foreground pt-6">
            Ambiente de demonstração — dados fictícios. Email, WhatsApp e SMS são simulados nesta apresentação.
          </p>
        </main>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- subviews */

function PlansGrid({ planPrice, planFeatures }: any) {
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

function Recommendation({ rec, planPrice, planFeatures }: any) {
  const below = rec.below as PlanSlug | null;
  const next = rec.next as PlanSlug | null;
  const recommended = rec.recommended as PlanSlug;
  const diff = (a: PlanSlug, b: PlanSlug) => planFeatures(b).filter((k: string) => !planFeatures(a).includes(k)).slice(0, 5);

  return (
    <Card className="border-primary">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Plano recomendado: {PLAN_LABEL[recommended]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-primary font-semibold text-lg">{planPrice(recommended)}<span className="text-muted-foreground text-sm font-normal">/mês</span></p>
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
            <p className="text-muted-foreground">Ficaria sem: {diff(below, recommended).map(label).join(", ") || "limites suficientes para o volume indicado"}.</p>
          </div>
        )}
        {next && (
          <div>
            <p className="font-medium">Quando faria sentido o plano superior ({PLAN_LABEL[next]})?</p>
            <p className="text-muted-foreground">Quando precisar de: {diff(recommended, next).map(label).join(", ") || "mais utilizadores e mais oficinas"}.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
