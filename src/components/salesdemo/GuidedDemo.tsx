/**
 * SALES DEMO — apresentação guiada (100% simulada, sem login).
 *
 * O comercial só precisa de avançar: cada etapa prepara o ecrã, mostra o
 * conteúdo e sugere o que dizer. Troca de plano sem sair da apresentação.
 * Nenhum dado real é lido ou escrito.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Pause, Play, RotateCcw, X, BarChart3,
  MessageCircleQuestion, Lightbulb, Lock, SkipForward, Check, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DemoStage } from "./DemoStage";
import DemoPlanCompare from "./DemoPlanCompare";
import { PLAN_LABEL, type DemoPlan } from "@/lib/salesDemo";
import { TOUR, PLAN_ORDER, planRank, PLAN_STEP_NOTE } from "@/lib/salesDemoTour";
import {
  loadSalesState, saveSalesState, clearSalesState, recommend,
  OBJECTIONS, needLabel, CONFIDENCE_LABEL,
} from "@/lib/salesDemoSales";
import { getCountryConfig, loadCountriesFromDB, formatPrice } from "@/lib/regionConfig";
import { trackEvent } from "@/lib/trackEvent";

const AUTO_MS = 30000;

export default function GuidedDemo({
  plan, onPlanChange, onExit, onRestart, mode = "sales",
}: {
  plan: DemoPlan;
  onPlanChange: (p: DemoPlan) => void;
  onExit: () => void;
  onRestart: () => void;
  /** "sales" = demo comercial (/demo-demonstracao) · "self" = demo autónoma (/demo) */
  mode?: "sales" | "self";
}) {
  const isSelf = mode === "self";
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  const [compare, setCompare] = useState(false);
  const [priceTick, setPriceTick] = useState(0);
  const [objection, setObjection] = useState<string | null>(null);
  const [state, setState] = useState(loadSalesState);

  const step = TOUR[idx];
  const last = idx === TOUR.length - 1;


  useEffect(() => {
    let alive = true;
    loadCountriesFromDB().then(() => { if (alive) setPriceTick((t) => t + 1); });
    return () => { alive = false; };
  }, []);

  const price = useCallback((p: DemoPlan) => {
    void priceTick;
    const cfg = getCountryConfig();
    const monthly = cfg.saas?.[p]?.monthly ?? 0;
    return monthly ? `${formatPrice(monthly, cfg.code)}/mês` : "—";
  }, [priceTick]);

  // Marca a área como demonstrada (para o resumo/recomendação)
  useEffect(() => {
    if (!step.need) return;
    setState((prev) => {
      if (prev.shown.includes(step.need!)) return prev;
      const next = { ...prev, shown: [...prev.shown, step.need!] };
      saveSalesState(next);
      return next;
    });
  }, [step.need]);

  const go = useCallback((n: number) => {
    setIdx((i) => Math.min(TOUR.length - 1, Math.max(0, i + n)));
  }, []);

  useEffect(() => {
    if (!auto || last) return;
    const t = setTimeout(() => go(1), AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, idx, last, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " ") { e.preventDefault(); setAuto((a) => !a); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const changePlan = (p: DemoPlan) => {
    if (p === plan) return;
    onPlanChange(p); // mantém a posição atual da apresentação
    trackEvent("sales_demo_plan_switch", { plan: p, step: step.id });
  };

  const locked = planRank(plan) < planRank(step.minPlan);
  const rec = useMemo(() => recommend(state), [state]);
  const progress = ((idx + 1) / TOUR.length) * 100;

  const restart = () => {
    clearSalesState();
    setState(loadSalesState());
    setIdx(0);
    setAuto(false);
    onRestart();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Topo — discreto */}
      <header className="border-b border-border/70 bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide">GarageFlow</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
            {isSelf ? "Demonstração" : "Sales Demo"}
          </span>


          <div className="ml-auto flex items-center gap-1">
            {/* Seletor de contexto — troca instantânea, sem sair da demo */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              {PLAN_ORDER.map((p) => (
                <button
                  key={p}
                  onClick={() => changePlan(p)}
                  className={`px-2.5 h-8 text-xs whitespace-nowrap transition-colors ${
                    p === plan ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {PLAN_LABEL[p]} <span className="opacity-80 tabular-nums">· {price(p)}</span>
                </button>
              ))}
            </div>

            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setCompare(true)}>
              <BarChart3 className="w-3.5 h-3.5 mr-1" />Comparar
            </Button>

            {!isSelf && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  <MessageCircleQuestion className="w-3.5 h-3.5 mr-1" />Objeções
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <ScrollArea className="max-h-80">
                  <div className="p-2">
                    {OBJECTIONS.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setObjection(objection === o.id ? null : o.id)}
                        className="w-full text-left rounded-md px-2 py-2 hover:bg-muted"
                      >
                        <p className="text-xs font-medium">{o.label}</p>
                        {objection === o.id && (
                          <p className="text-xs text-muted-foreground mt-1">{o.answer}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            )}


            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset" aria-label="Reset" onClick={restart}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Sair" aria-label="Sair" onClick={onExit}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="h-0.5 bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Palco */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 pb-40">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="text-[10px]">{idx + 1}/{TOUR.length}</Badge>
          <h1 className="text-2xl font-bold tracking-tight">{step.area}</h1>
          {locked && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              <Lock className="w-3 h-3 mr-1" />Incluído a partir do {PLAN_LABEL[step.minPlan]}
            </Badge>
          )}
        </div>

        <div key={`${step.id}-${plan}`} className="animate-fade-in">
          {step.stage === "plans" ? (
            <PlansStep plan={plan} price={price} onSelect={changePlan} onCompare={() => setCompare(true)} />
          ) : step.stage === "recommendation" ? (
            <RecommendationStep rec={rec} price={price} state={state} onSelect={changePlan} />
          ) : (
            <div className={locked ? "relative" : ""}>
              <div className={locked ? "opacity-40 pointer-events-none select-none" : ""}>
                <DemoStage step={step.stage} />
              </div>
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-xl border border-border bg-card px-4 py-3 text-center shadow-lg">
                    <p className="text-sm font-semibold">{PLAN_STEP_NOTE[plan]}</p>
                    <Button size="sm" className="mt-2 h-8 text-xs" onClick={() => changePlan(step.minPlan)}>
                      Mostrar no {PLAN_LABEL[step.minPlan]} · {price(step.minPlan)}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {step.value && !locked && (
          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3 flex gap-2">
            <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">O que isto resolve</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.value}</p>
            </div>
          </div>
        )}
      </main>

      {/* Guião + controlos — discretos, fixos */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <p className="flex-1 text-sm text-muted-foreground italic line-clamp-2">“{step.say}”</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Voltar" aria-label="Voltar" onClick={() => go(-1)} disabled={idx === 0}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" title={auto ? "Pausar" : "Automático"} aria-label="Automático" onClick={() => setAuto((a) => !a)}>
              {auto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:inline-flex" title="Saltar etapa" aria-label="Saltar etapa" onClick={() => go(1)} disabled={last}>
              <SkipForward className="w-4 h-4" />
            </Button>
            {last ? (
              <Button asChild size="sm" className="h-9 px-4 font-semibold">
                <Link to="/#pricing" onClick={() => trackEvent("sales_demo_cta", { plan: rec.plan })}>
                  Próximo passo
                </Link>
              </Button>
            ) : (
              <Button size="sm" className="h-9 px-4 font-semibold" onClick={() => go(1)}>
                Avançar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <DemoPlanCompare
        open={compare}
        onOpenChange={setCompare}
        plan={plan}
        priceLabel={price}
        onSelect={changePlan}
      />
    </div>
  );
}

function PlansStep({ plan, price, onSelect, onCompare }: {
  plan: DemoPlan; price: (p: DemoPlan) => string;
  onSelect: (p: DemoPlan) => void; onCompare: () => void;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_ORDER.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className={`rounded-2xl border p-5 text-left transition-all ${
              p === plan ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold uppercase tracking-wide">{PLAN_LABEL[p]}</span>
              {p === plan && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums">{price(p)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {p === plan ? "Contexto atual da demonstração" : "Ver a demonstração neste plano"}
            </p>
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-4 h-9" onClick={onCompare}>
        <BarChart3 className="w-4 h-4 mr-1.5" />O que muda entre os planos?
      </Button>
    </div>
  );
}

function RecommendationStep({ rec, price, state, onSelect }: {
  rec: ReturnType<typeof recommend>; price: (p: DemoPlan) => string;
  state: ReturnType<typeof loadSalesState>; onSelect: (p: DemoPlan) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" /> Plano recomendado
        </p>
        <p className="text-3xl font-bold mt-2">{PLAN_LABEL[rec.plan]}</p>
        <p className="text-lg font-semibold text-primary tabular-nums">{price(rec.plan)}</p>
        <Badge variant="outline" className="mt-2 text-[10px]">{CONFIDENCE_LABEL[rec.confidence]}</Badge>

        <p className="text-xs font-semibold mt-4">Porque este plano?</p>
        <ul className="mt-1 space-y-1">
          {rec.reasons.map((r) => (
            <li key={r} className="text-xs text-muted-foreground flex gap-2">
              <span className="w-1 h-1 rounded-full bg-primary/70 mt-1.5 shrink-0" />{r}
            </li>
          ))}
        </ul>
        {rec.aboveNote && (
          <>
            <p className="text-xs font-semibold mt-4">Quando faria sentido subir?</p>
            <p className="text-xs text-muted-foreground mt-1">{rec.aboveNote}</p>
          </>
        )}
        {rec.belowNote && <p className="text-xs text-muted-foreground mt-3">{rec.belowNote}</p>}
        <Button size="sm" variant="outline" className="mt-4 h-8 text-xs" onClick={() => onSelect(rec.plan)}>
          Mostrar a demonstração no {PLAN_LABEL[rec.plan]}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">O que vimos</p>
        {state.needs.length > 0 && (
          <>
            <p className="text-xs font-semibold mt-3">Necessidades identificadas</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {state.needs.map((n) => (
                <Badge key={n} variant="secondary" className="text-[10px]">{needLabel(n)}</Badge>
              ))}
            </div>
          </>
        )}
        <p className="text-xs font-semibold mt-4">Áreas demonstradas</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {state.shown.length === 0
            ? <span className="text-xs text-muted-foreground">—</span>
            : state.shown.map((n) => (
              <Badge key={n} variant="outline" className="text-[10px]">{needLabel(n)}</Badge>
            ))}
        </div>
        {state.profile.shopName && (
          <p className="text-xs text-muted-foreground mt-4">Oficina: {state.profile.shopName}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-4">
          Dados fictícios de demonstração · AutoPrime Lisboa
        </p>
      </div>
    </div>
  );
}
