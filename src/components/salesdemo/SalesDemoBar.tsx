/**
 * Controlo discreto do modo demonstração.
 * Visível apenas em sessões iniciadas em /demo-demonstracao.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, RotateCcw, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  currentDemoPlan, isDemoSession, resetDemo, switchDemoPlan, endDemo,
  DEMO_BAR_HIDDEN, PLAN_LABEL, type DemoPlan,
} from "@/lib/salesDemo";

const PLANS: DemoPlan[] = ["free", "pro", "garage"];

export default function SalesDemoBar() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DemoPlan>(currentDemoPlan());
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(DEMO_BAR_HIDDEN) === "1"; } catch { return false; }
  });

  if (!isDemoSession()) return null;

  const toggleHidden = (v: boolean) => {
    setHidden(v);
    try { sessionStorage.setItem(DEMO_BAR_HIDDEN, v ? "1" : "0"); } catch { /* noop */ }
  };

  if (hidden) {
    return (
      <button
        onClick={() => toggleHidden(false)}
        title="Mostrar controlo de demonstração"
        aria-label="Mostrar controlo de demonstração"
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
      toast.success("Demonstração reposta");
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-1 rounded-full border border-border/70 bg-card/90 backdrop-blur px-2 py-1 shadow-lg">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-1.5">Sales Demo</span>
      <Button
        variant="ghost" size="sm" className="h-7 px-2 text-xs"
        onClick={async () => { await endDemo(); navigate("/demo-demonstracao"); }}
      >
        <Home className="w-3.5 h-3.5 mr-1" />Início
      </Button>
      {PLANS.map((p) => (
        <Button
          key={p}
          variant={p === plan ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={busy !== null}
          onClick={() => changePlan(p)}
        >
          {busy === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : PLAN_LABEL[p]}
        </Button>
      ))}
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy !== null} onClick={doReset}>
        {busy === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
        Reset
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Esconder" aria-label="Esconder" onClick={() => toggleHidden(true)}>
        <EyeOff className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
