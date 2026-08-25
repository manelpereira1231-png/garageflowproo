/**
 * GARAGEFLOW SALES DEMO — /demo-demonstracao
 *
 * Porta de entrada comercial: o comercial escolhe o contexto (Free / Pro / Garage)
 * e entra no GarageFlow REAL, com a oficina de demonstração "AutoPrime Lisboa".
 * Não duplica páginas nem componentes do ERP — apenas prepara a sessão.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Rocket, Check, ChevronDown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDemo, type DemoPlan } from "@/lib/salesDemo";

const OPTIONS: { plan: DemoPlan; name: string; tagline: string; points: string[] }[] = [
  {
    plan: "free",
    name: "Free",
    tagline: "Demonstração do plano Free",
    points: ["Clientes e viaturas", "Orçamentos essenciais", "Arranque imediato"],
  },
  {
    plan: "pro",
    name: "Pro",
    tagline: "Demonstração do plano Pro",
    points: ["Reparações e stock", "Faturação e PDFs", "Métricas da oficina"],
  },
  {
    plan: "garage",
    name: "Garage",
    tagline: "Demonstração do plano Garage",
    points: ["Multi-oficina", "Equipa e permissões", "Automações e IA"],
  },
];

/** Notas opcionais — o comercial pode ignorar por completo. */
const NOTE_KEY = "gf_sales_demo_notes";

export default function SalesDemo() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DemoPlan>("pro");
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(() => {
    try { return sessionStorage.getItem(NOTE_KEY) || ""; } catch { return ""; }
  });

  const start = async () => {
    setLoading(true);
    try {
      await startDemo(plan);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível iniciar a demonstração");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-16 sm:py-24 flex flex-col justify-center">
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary" />
            </span>
            <span className="text-sm font-semibold tracking-wide">GarageFlow</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Sales Demo
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Apresente o GarageFlow<br className="hidden sm:block" /> à sua próxima oficina.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Escolha o contexto da apresentação e entre diretamente no GarageFlow, com a oficina
            de demonstração AutoPrime Lisboa já preparada.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const active = plan === o.plan;
            return (
              <button
                key={o.plan}
                type="button"
                onClick={() => setPlan(o.plan)}
                aria-pressed={active}
                className={`text-left rounded-2xl border p-5 transition-all min-h-[176px] ${
                  active
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold uppercase tracking-wide">{o.name}</span>
                  {active && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{o.tagline}</p>
                <ul className="mt-4 space-y-1.5">
                  {o.points.map((p) => (
                    <li key={p} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-primary/70" />
                      {p}
                    </li>
                  ))}
                </ul>
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
            onClick={() => setShowNotes((v) => !v)}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start sm:self-auto"
          >
            Personalizar apresentação
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNotes ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showNotes && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 max-w-xl">
            <p className="text-xs text-muted-foreground mb-2">
              Opcional — notas sobre a oficina (dimensão, software atual, dores). Ficam apenas neste dispositivo.
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                try { sessionStorage.setItem(NOTE_KEY, e.target.value); } catch { /* noop */ }
              }}
              rows={4}
              className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary/60"
              placeholder="Ex.: 6 colaboradores, 30 viaturas/semana, usa folhas de Excel…"
            />
          </div>
        )}

        <p className="mt-12 text-xs text-muted-foreground">
          Dados fictícios de demonstração. Nenhuma conta real, faturação ou subscrição é criada ou alterada.
        </p>
      </div>
    </div>
  );
}
