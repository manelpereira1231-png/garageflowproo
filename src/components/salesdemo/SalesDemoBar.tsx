/**
 * Controlo discreto do modo demonstração.
 * Visível apenas em sessões iniciadas em /demo-demonstracao.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, RotateCcw, Home, Loader2, BarChart3, Target, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  currentDemoPlan, isDemoSession, resetDemo, switchDemoPlan, endDemo,
  DEMO_BAR_HIDDEN, DEMO_MODE_KEY, PLAN_LABEL, type DemoPlan,
} from "@/lib/salesDemo";
import { getCountryConfig, loadCountriesFromDB, formatPrice } from "@/lib/regionConfig";
import DemoPlanCompare from "./DemoPlanCompare";
import SalesConsole from "./SalesConsole";
import { clearSalesState } from "@/lib/salesDemoSales";
import { trackEvent } from "@/lib/trackEvent";

const PLANS: DemoPlan[] = ["free", "pro", "garage"];

export default function SalesDemoBar() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DemoPlan>(currentDemoPlan());
  const [busy, setBusy] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [console_, setConsole] = useState(false);
  const [priceTick, setPriceTick] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DEMO_BAR_HIDDEN) === "1"; } catch { return false; }
  });
  const isSalesMode = (() => {
    try { return localStorage.getItem(DEMO_MODE_KEY) === "sales"; } catch { return false; }
  })();

  useEffect(() => {
    let alive = true;
    loadCountriesFromDB().then(() => { if (alive) setPriceTick((t) => t + 1); });
    return () => { alive = false; };
  }, []);

  if (!isDemoSession()) return null;

  const priceLabel = (p: DemoPlan) => {
    void priceTick;
    const cfg = getCountryConfig();
    const monthly = cfg.saas?.[p]?.monthly ?? 0;
    if (!monthly) return "—";
    return `${formatPrice(monthly, cfg.code)}/mês`;
  };

  const toggleHidden = (v: boolean) => {
    setHidden(v);
    try { localStorage.setItem(DEMO_BAR_HIDDEN, v ? "1" : "0"); } catch { /* noop */ }
  };

  if (hidden) {
    return (
      <button
        onClick={() => toggleHidden(false)}
        title="Sair do modo cliente"
        aria-label="Sair do modo cliente"
        className="fixed bottom-3 left-3 z-50 w-8 h-8 rounded-full bg-card/70 border border-border/60 text-muted-foreground hover:text-foreground backdrop-blur flex items-center justify-center"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
    );
  }

  const changePlan = async (p: DemoPlan) => {
    if (p === plan) return;
    setBusy(p);
    try {
      await switchDemoPlan(p);
      trackEvent("sales_demo_plan_viewed", { plan: p });
      setPlan(p);
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doReset = async () => {
    setBusy("reset");
    try {
      await resetDemo(plan);
      clearSalesState();
      toast.success("Demonstração reposta");
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="fixed bottom-3 left-3 z-50 flex flex-wrap items-center gap-1 rounded-2xl border border-border/70 bg-card/90 backdrop-blur px-2 py-1.5 shadow-lg max-w-[calc(100vw-1.5rem)]">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-1.5">Conta Demo</span>
        <Button
          variant="ghost" size="sm" className="h-7 px-2 text-xs"
          onClick={async () => { await endDemo(); navigate(isSalesMode ? "/demo-demonstracao" : "/demo"); }}
        >
          <Home className="w-3.5 h-3.5 mr-1" />Início
        </Button>
        {isSalesMode && PLANS.map((p) => (
          <Button
            key={p}
            variant={p === plan ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-2.5 text-xs whitespace-nowrap ${p === plan ? "ring-1 ring-primary/60 font-semibold" : ""}`}
            disabled={busy !== null}
            onClick={() => changePlan(p)}
            title={`${PLAN_LABEL[p]} · ${priceLabel(p)}`}
          >
            {busy === p ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                {PLAN_LABEL[p]}
                <span className="ml-1 opacity-80 tabular-nums">· {priceLabel(p)}</span>
              </>
            )}
          </Button>
        ))}
        {isSalesMode && <Button
          variant="ghost" size="sm" className="h-7 px-2 text-xs whitespace-nowrap"
          onClick={() => setConsole(true)}
        >
          <Target className="w-3.5 h-3.5 mr-1" />Consola
        </Button>}
        {isSalesMode && <Button
          variant="ghost" size="sm" className="h-7 px-2 text-xs whitespace-nowrap"
          onClick={() => { trackEvent("sales_demo_compare_opened", { plan }); setCompare(true); }}
        >
          <BarChart3 className="w-3.5 h-3.5 mr-1" />Comparar planos
        </Button>}
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy !== null} onClick={doReset}>
          {busy === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
          Reset
        </Button>
        <Button variant="default" size="sm" className="h-7 px-2 text-xs" onClick={async () => { await endDemo(); window.location.assign("/auth?mode=signup"); }}>
          <Rocket className="w-3.5 h-3.5 mr-1" /> Experimentar gratuitamente
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Modo cliente (esconder)" aria-label="Modo cliente" onClick={() => toggleHidden(true)}>
          <EyeOff className="w-3.5 h-3.5" />
        </Button>
      </div>

      <DemoPlanCompare
        open={compare}
        onOpenChange={setCompare}
        plan={plan}
        priceLabel={priceLabel}
        onSelect={changePlan}
      />

      <SalesConsole
        open={console_}
        onOpenChange={setConsole}
        plan={plan}
        priceLabel={priceLabel}
        onSelectPlan={changePlan}
      />
    </>
  );
}
