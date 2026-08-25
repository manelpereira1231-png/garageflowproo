/**
 * Palco visual da Sales Demo — mocks estáticos (AutoPrime Lisboa, dados
 * fictícios) para o comercial mostrar cada etapa sem depender de login.
 * NÃO lê nem escreve dados reais.
 */
import {
  Car, User, FileText, Wrench, Package, ListChecks, TrendingUp, Check,
  Clock, Euro, CalendarDays, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
      <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
      <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
      <span className="ml-2 text-xs text-muted-foreground truncate">{title}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Kpi = ({ label, value, sub }: any) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-xl font-bold mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-primary mt-0.5">{sub}</p>}
  </div>
);

const Row = ({ cols, muted }: { cols: string[]; muted?: boolean }) => (
  <div className={`grid grid-cols-4 gap-2 px-3 py-2 text-sm ${muted ? "text-muted-foreground" : ""}`}>
    {cols.map((c, i) => (
      <span key={i} className={i === 0 ? "font-medium truncate" : "truncate"}>{c}</span>
    ))}
  </div>
);

const Timeline = ({ active }: { active: number }) => {
  const steps = ["Receção", "Diagnóstico", "Aprovação", "Reparação", "Entrega"];
  return (
    <div className="flex items-center w-full">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i <= active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < active ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < active ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export function DemoStage({ step }: { step: string }) {
  switch (step) {
    case "dashboard":
      return (
        <Frame title="AutoPrime Lisboa — Dashboard">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Serviços do mês" value="38" sub="+12% vs mês anterior" />
            <Kpi label="Faturado" value="14 250 €" sub="+8%" />
            <Kpi label="Orçamentos por aprovar" value="6" sub="2 490 € em jogo" />
            <Kpi label="Viaturas na oficina" value="9" sub="3 prontas a entregar" />
          </div>
          <div className="mt-4 rounded-lg border border-border">
            <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground">Serviços recentes</div>
            <Row cols={["OS-2041", "Golf VII · 12-AB-34", "Reparação", "480,00 €"]} />
            <Row cols={["OS-2040", "Clio IV · 45-CD-67", "Aprovação", "215,50 €"]} muted />
            <Row cols={["OS-2039", "Astra · 89-EF-01", "Entregue", "132,90 €"]} muted />
          </div>
        </Frame>
      );

    case "client":
      return (
        <Frame title="Clientes — Ficha de cliente">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="font-semibold">Rui Marques</p>
              <p className="text-xs text-muted-foreground">912 000 000 · rui@exemplo.pt · NIF 500 000 000</p>
            </div>
            <Badge variant="outline" className="ml-auto">Cliente desde 2022</Badge>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
            <Kpi label="Viaturas" value="2" />
            <Kpi label="Serviços" value="11" />
            <Kpi label="Total faturado" value="3 180 €" />
          </div>
        </Frame>
      );

    case "vehicle":
      return (
        <Frame title="Viaturas — VW Golf VII 1.6 TDI">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center"><Car className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="font-semibold">12-AB-34 · VW Golf VII</p>
              <p className="text-xs text-muted-foreground">2016 · Diesel · 187 400 km · Rui Marques</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <Kpi label="Última visita" value="03/2026" />
            <Kpi label="Próxima revisão" value="09/2026" />
            <Kpi label="Intervenções" value="7" />
          </div>
        </Frame>
      );

    case "history":
      return (
        <Frame title="Histórico da viatura 12-AB-34">
          {[
            ["03/2026", "Revisão + filtros", "185,00 €"],
            ["11/2025", "Pastilhas travão frente", "142,50 €"],
            ["06/2025", "Correia distribuição", "620,00 €"],
            ["01/2025", "Diagnóstico eletrónico", "45,00 €"],
          ].map(([d, t, v]) => (
            <div key={d} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="w-20 text-muted-foreground">{d}</span>
              <span className="flex-1">{t}</span>
              <span className="font-medium whitespace-nowrap">{v}</span>
            </div>
          ))}
        </Frame>
      );

    case "quote":
      return (
        <Frame title="Orçamento ORC-2026/118">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Golf VII · 12-AB-34</span>
            <Badge>Aguarda aprovação</Badge>
          </div>
          <div className="mt-3 rounded-lg border border-border text-sm">
            {[["Mão de obra (2h)", "90,00 €"], ["Pastilhas travão", "62,40 €"], ["Discos travão", "98,00 €"]].map(([a, b]) => (
              <div key={a} className="flex justify-between px-3 py-2 border-b border-border last:border-0">
                <span>{a}</span><span className="whitespace-nowrap">{b}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 font-semibold">
            <span>Total c/ IVA</span><span className="text-primary">308,50 €</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Enviado por email/WhatsApp com aprovação digital (simulado na demo).
          </p>
        </Frame>
      );

    case "parts":
      return (
        <Frame title="Stock — peças consumidas">
          {[["Pastilhas travão FR", "4", "12 → 8"], ["Discos travão", "2", "6 → 4"], ["Óleo 5W30 (L)", "4", "38 → 34"]].map(([p, q, s]) => (
            <div key={p} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
              <Package className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1">{p}</span>
              <span className="text-muted-foreground">x{q}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{s}</span>
            </div>
          ))}
        </Frame>
      );

    case "services":
    case "repair":
      return (
        <Frame title="Serviços — OS-2041">
          <Timeline active={step === "repair" ? 3 : 2} />
          <div className="mt-4 rounded-lg border border-border">
            <Row cols={["OS-2041", "Golf VII", "Reparação", "480,00 €"]} />
            <Row cols={["OS-2040", "Clio IV", "Aprovação", "215,50 €"]} muted />
            <Row cols={["OS-2038", "Astra", "Diagnóstico", "—"]} muted />
          </div>
        </Frame>
      );

    case "tasks":
      return (
        <Frame title="Modo Oficina — tarefas do técnico">
          {[["Substituir pastilhas — OS-2041", "Em curso"], ["Diagnóstico eletrónico — OS-2038", "Por iniciar"], ["Mudança de óleo — OS-2037", "Concluída"]].map(([t, s]) => (
            <div key={t} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
              <ListChecks className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1">{t}</span>
              <Badge variant="outline" className="text-[10px]">{s}</Badge>
            </div>
          ))}
        </Frame>
      );

    case "metrics":
      return (
        <Frame title="Relatórios financeiros">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Faturação (mês)" value="14 250 €" sub="+8%" />
            <Kpi label="Ticket médio" value="375 €" />
            <Kpi label="Taxa de aprovação" value="74%" />
            <Kpi label="Serviços/dia" value="1,8" />
          </div>
          <div className="mt-4 flex items-end gap-1.5 h-24">
            {[40, 55, 48, 70, 62, 85, 78, 96].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Evolução dos últimos 8 meses (dados fictícios).</p>
        </Frame>
      );

    case "conversion":
      return (
        <Frame title="Arranque">
          <div className="space-y-2 text-sm">
            {["Criar conta da oficina", "Importar clientes e viaturas (Excel/CSV)", "Emitir o primeiro orçamento", "Acompanhar a primeira reparação"].map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Normalmente no mesmo dia.</p>
        </Frame>
      );

    default:
      return null;
  }
}

export { Euro, Wrench };
