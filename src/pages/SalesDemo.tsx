/**
 * GARAGEFLOW SALES DEMO — /demo-demonstracao
 *
 * Entrada da apresentação comercial: escolher o contexto (Start / Pro / Garage)
 * e começar. 100% simulada — sem login, sem conta real, sem faturação.
 */
import { useEffect, useState } from "react";
import { Loader2, Rocket, Check, ChevronDown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_LABEL, type DemoPlan } from "@/lib/salesDemo";
import { PLAN_ORDER } from "@/lib/salesDemoTour";
import {
  loadSalesState, saveSalesState, clearSalesState, NEEDS,
} from "@/lib/salesDemoSales";
import { getCountryConfig, loadCountriesFromDB, formatPrice } from "@/lib/regionConfig";
import { trackEvent } from "@/lib/trackEvent";
import GuidedDemo from "@/components/salesdemo/GuidedDemo";

export default function SalesDemo() {
  const [plan, setPlan] = useState<DemoPlan>("pro");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [priceTick, setPriceTick] = useState(0);
  const [state, setState] = useState(loadSalesState);

  useEffect(() => {
    let alive = true;
    loadCountriesFromDB().then(() => { if (alive) setPriceTick((t) => t + 1); });
    return () => { alive = false; };
  }, []);

  const price = (p: DemoPlan) => {
    void priceTick;
    const cfg = getCountryConfig();
    const monthly = cfg.saas?.[p]?.monthly ?? 0;
    return monthly ? `${formatPrice(monthly, cfg.code)}/mês` : "—";
  };

  const update = (next: typeof state) => { setState(next); saveSalesState(next); };

  const toggleNeed = (id: string) => {
    const needs = state.needs.includes(id) ? state.needs.filter((n) => n !== id) : [...state.needs, id];
    update({ ...state, needs });
  };

  const start = () => {
    setLoading(true);
    trackEvent("sales_demo_started", { plan });
    setStarted(true);
    setLoading(false);
  };

  if (started) {
    return (
      <GuidedDemo
        plan={plan}
        onPlanChange={setPlan}
        onExit={() => setStarted(false)}
        onRestart={() => {
          clearSalesState();
          setState(loadSalesState());
          setStarted(false);
          setShowSetup(false);
        }}
      />
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 sm:py-24 flex flex-col justify-center">
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary" />
            </span>
            <span className="text-sm font-semibold tracking-wide">GarageFlow</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Sales Demo
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Escolha o contexto<br className="hidden sm:block" /> da apresentação.
          </h1>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_ORDER.map((p) => {
            const active = plan === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                aria-pressed={active}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold uppercase tracking-wide">{PLAN_LABEL[p]}</span>
                  {active && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">{price(p)}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <Button size="lg" className="h-12 px-8 text-base font-semibold" onClick={start} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Começar apresentação
          </Button>
          <button
            type="button"
            onClick={() => setShowSetup((v) => !v)}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start sm:self-auto"
          >
            🎯 Personalizar apresentação
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSetup ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showSetup && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { k: "shopName" as const, ph: "Nome da oficina" },
                { k: "users" as const, ph: "Utilizadores" },
                { k: "vehiclesMonth" as const, ph: "Veículos/mês" },
              ].map((f) => (
                <input
                  key={f.k}
                  value={state.profile[f.k]}
                  onChange={(e) => update({ ...state, profile: { ...state.profile, [f.k]: e.target.value } })}
                  placeholder={f.ph}
                  className="bg-background border border-border rounded-lg px-3 h-10 text-sm outline-none focus:border-primary/60"
                />
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Necessidades da oficina (opcional)</p>
              <div className="flex flex-wrap gap-1.5">
                {NEEDS.map((n) => (
                  <button key={n.id} type="button" onClick={() => toggleNeed(n.id)}>
                    <Badge
                      variant={state.needs.includes(n.id) ? "default" : "outline"}
                      className="text-[11px] cursor-pointer"
                    >
                      {n.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="mt-12 text-xs text-muted-foreground">
          Dados fictícios de demonstração · AutoPrime Lisboa
        </p>
      </div>
    </div>
  );
}
