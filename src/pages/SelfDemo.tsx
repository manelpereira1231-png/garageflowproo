/**
 * DEMO AUTÓNOMA — /demo
 *
 * Percurso guiado que o próprio visitante conduz (Cliente → Viatura →
 * Orçamento → Notificação → Reparação → Relatórios). 100% simulada:
 * sem login, sem conta real, sem dados reais.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Rocket, Wrench, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LABEL, type DemoPlan } from "@/lib/salesDemo";
import { PLAN_ORDER } from "@/lib/salesDemoTour";
import { clearSalesState } from "@/lib/salesDemoSales";
import { getCountryConfig, loadCountriesFromDB, formatPrice } from "@/lib/regionConfig";
import { trackEvent } from "@/lib/trackEvent";
import GuidedDemo from "@/components/salesdemo/GuidedDemo";

export default function SelfDemo() {
  const [plan, setPlan] = useState<DemoPlan>("pro");
  const [started, setStarted] = useState(false);
  const [priceTick, setPriceTick] = useState(0);

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

  if (started) {
    return (
      <GuidedDemo
        mode="self"
        plan={plan}
        onPlanChange={setPlan}
        onExit={() => setStarted(false)}
        onRestart={() => { clearSalesState(); setStarted(false); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Helmet>
        <title>Ver demonstração — GarageFlow</title>
        <meta
          name="description"
          content="Veja o GarageFlow a funcionar: cliente, viatura, orçamento aprovado no telemóvel, reparação e relatórios. Demonstração simulada, sem registo."
        />
      </Helmet>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 sm:py-24 flex flex-col justify-center">
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary" />
            </span>
            <span className="text-sm font-semibold tracking-wide">GarageFlow</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Demonstração
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Veja o GarageFlow<br className="hidden sm:block" /> a funcionar.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl">
            Um caso real do princípio ao fim: o cliente chega, a viatura entra, o orçamento
            é aprovado no telemóvel, a reparação avança e o mês fecha com números.
            Avança ao seu ritmo — nada aqui são dados reais.
          </p>
        </header>

        <p className="text-xs text-muted-foreground mb-2">Ver a demonstração no plano</p>
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
          <Button
            size="lg"
            className="h-12 px-8 text-base font-semibold"
            onClick={() => { trackEvent("self_demo_started", { plan }); setStarted(true); }}
          >
            <Rocket className="w-4 h-4 mr-2" /> Começar demonstração
          </Button>
          <Link to="/marcar-demonstracao" className="text-sm text-muted-foreground hover:text-foreground self-start sm:self-auto">
            Prefere falar com alguém? Marcar demonstração
          </Link>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          Dados fictícios de demonstração · AutoPrime Lisboa
        </p>
      </div>
    </div>
  );
}
