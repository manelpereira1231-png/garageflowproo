/**
 * DEMO AUTÓNOMA — /demo
 *
 * Percurso que o próprio visitante conduz dentro da aplicação real
 * (oficina fictícia AutoPrime Lisboa). Sem informação comercial, sem
 * consola de vendas: explorar → perceber → experimentar → registar.
 */
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDemo } from "@/lib/salesDemo";

export default function SelfDemo() {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const stages = [900, 1800, 2600];
    const timers = stages.map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [attempt]);

  useEffect(() => {
    let active = true;
    startDemo("garage", "self")
      .then(() => { if (active) window.location.replace("/dashboard"); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a demonstração."); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Helmet>
        <title>Ver demonstração — GarageFlow</title>
        <meta
          name="description"
          content="Explore uma conta GarageFlow configurada com dados fictícios, usando a aplicação real."
        />
      </Helmet>

      <div className="text-center max-w-md">
        {error ? <>
          <h1 className="text-xl font-semibold">Não foi possível abrir a conta Demo</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>
            <RotateCcw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </> : <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <h1 className="mt-4 text-xl font-semibold">A preparar a AutoPrime Lisboa</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {["A criar a oficina de demonstração…", "A carregar clientes e viaturas…", "A preparar orçamentos e reparações…", "Quase pronto — a abrir o painel…"][Math.min(stage, 3)]}
          </p>
          <div className="mx-auto mt-4 h-1 w-56 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${25 + stage * 22}%` }} />
          </div>
        </>}
      </div>
    </div>
  );
}
