/**
 * DEMO AUTÓNOMA — /demo
 *
 * Percurso que o próprio visitante conduz dentro da aplicação real
 * (oficina fictícia AutoPrime Lisboa). Sem informação comercial, sem
 * consola de vendas: explorar → perceber → experimentar → registar.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Rocket, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSalesState } from "@/lib/salesDemoSales";
import { trackEvent } from "@/lib/trackEvent";
import GuidedDemo from "@/components/salesdemo/GuidedDemo";

export default function SelfDemo() {
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <GuidedDemo
        mode="self"
        plan="garage"
        onPlanChange={() => {}}
        onExit={() => setStarted(false)}
        onRestart={() => { clearSalesState(); setStarted(false); }}
      />
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <Helmet>
        <title>Ver demonstração — GarageFlow</title>
        <meta
          name="description"
          content="Explore o GarageFlow a funcionar: cliente, veículo, orçamento aprovado no telemóvel, reparação, agenda, stock e faturação. Demonstração simulada, sem registo."
        />
      </Helmet>

      <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-16 sm:py-24 flex flex-col justify-center">
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
          Entre numa oficina<br className="hidden sm:block" /> dentro do GarageFlow.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          A AutoPrime Lisboa é uma oficina fictícia dentro da aplicação real. Siga um caso
          do princípio ao fim — cliente, veículo, orçamento aprovado no telemóvel, reparação,
          peças, agenda, faturação e relatórios — ou salte para o módulo que quiser.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <Button
            size="lg"
            className="h-12 px-8 text-base font-semibold"
            onClick={() => { trackEvent("self_demo_started", {}); setStarted(true); }}
          >
            <Rocket className="w-4 h-4 mr-2" /> Começar demonstração
          </Button>
          <Link to="/auth?mode=signup" className="text-sm text-muted-foreground hover:text-foreground self-start sm:self-auto">
            Prefere ir directo? Experimentar gratuitamente
          </Link>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          Dados fictícios de demonstração · AutoPrime Lisboa
        </p>
      </div>
    </div>
  );
}
