import { Wrench, FileText, Users, BarChart3, CheckCircle2, Clock, MessageCircle, Bell } from "lucide-react";

const NAV = [
  { icon: BarChart3, label: "Dashboard", active: true },
  { icon: FileText, label: "Orçamentos" },
  { icon: Wrench, label: "Serviços" },
  { icon: Users, label: "Clientes" },
  { icon: Bell, label: "Alertas" },
];

const KPIS = [
  { v: "12", l: "Em curso", c: "text-primary" },
  { v: "5", l: "Aprovação", c: "text-amber-500" },
  { v: "3", l: "Prontos", c: "text-green-500" },
  { v: "€4.2k", l: "Mês", c: "text-foreground" },
];

const ORDERS = [
  { c: "Maria Silva", v: "BMW 320d · 02-AB-12", s: "Em curso", color: "bg-primary/15 text-primary", time: "2h" },
  { c: "João Pereira", v: "VW Golf · 45-CD-67", s: "Aprovação", color: "bg-amber-400/15 text-amber-600", time: "30m" },
  { c: "Ana Costa", v: "Renault Clio · 88-EF-90", s: "Pronto", color: "bg-green-400/15 text-green-600", time: "1h" },
  { c: "Pedro Sousa", v: "Audi A4 · 12-GH-34", s: "Em curso", color: "bg-primary/15 text-primary", time: "4h" },
];

/**
 * Pure CSS mockup of the GarageFlow ERP dashboard.
 * Mobile: single column, 2x2 KPI grid, larger legible type, no fixed aspect ratio.
 * Desktop (sm+): sidebar + fixed 16/10 frame with floating WhatsApp phone.
 */
export default function HeroMockup() {
  return (
    <div className="relative w-full max-w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-card sm:aspect-[16/10]">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70 shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70 shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/70 shrink-0" />
        <div className="ml-2 sm:ml-3 min-w-0 px-2.5 py-0.5 rounded-md bg-background text-[10px] text-muted-foreground font-mono truncate">
          app.garageflow.pt/dashboard
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] sm:h-[calc(100%-32px)]">
        {/* Mobile app bar */}
        <div className="flex sm:hidden items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/20">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0">
            <Wrench className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold">GarageFlow</span>
          <span className="ml-auto text-[11px] text-muted-foreground">Hoje · 12 Mai</span>
        </div>

        {/* Sidebar (desktop) */}
        <aside className="border-r border-border bg-muted/20 p-3 hidden sm:block">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold">GarageFlow</span>
          </div>
          {NAV.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs mb-1 ${
                active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
          ))}
        </aside>

        {/* Main */}
        <main className="p-3 sm:p-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] sm:text-base font-bold">Painel da oficina</h3>
            <span className="text-[10px] text-muted-foreground hidden sm:block">Hoje · 12 de Maio</span>
          </div>

          {/* KPI cards — 2x2 on mobile, 4 columns from sm */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {KPIS.map((k) => (
              <div key={k.l} className="rounded-lg border border-border bg-background p-2.5 sm:p-2 min-w-0">
                <p className={`text-lg sm:text-lg font-bold leading-tight truncate ${k.c}`}>{k.v}</p>
                <p className="text-[11px] sm:text-[10px] text-muted-foreground truncate">{k.l}</p>
              </div>
            ))}
          </div>

          {/* Work orders list */}
          <div className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="px-2.5 py-1.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ordens ativas</span>
              <span className="text-[10px] text-muted-foreground">5</span>
            </div>
            {ORDERS.map((row) => (
              <div key={row.c} className="flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 border-b border-border/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-[12px] sm:text-[11px] font-medium truncate">{row.c}</p>
                  <p className="text-[11px] sm:text-[10px] text-muted-foreground truncate">{row.v}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" /> {row.time}
                  </span>
                  <span className={`text-[10px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${row.color}`}>{row.s}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile WhatsApp preview — inline card instead of overlapping phone */}
          <div className="sm:hidden mt-3 rounded-lg border border-border overflow-hidden">
            <div className="p-2 bg-[#075E54] text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold leading-tight truncate">Maria Silva</p>
                <p className="text-[9px] opacity-80 leading-tight">online</p>
              </div>
            </div>
            <div className="p-2 space-y-1.5 bg-[#ECE5DD]">
              <div className="bg-white rounded-lg p-1.5 max-w-[85%] shadow-sm">
                <p className="text-[11px] text-neutral-800">Orçamento #1042 pronto: €245</p>
              </div>
              <div className="bg-[#DCF8C6] rounded-lg p-1.5 max-w-[85%] shadow-sm ml-auto">
                <p className="text-[11px] text-neutral-800 flex items-center gap-1">Aprovado <CheckCircle2 className="w-3 h-3 text-green-600" /></p>
              </div>
              <div className="bg-white rounded-lg p-1.5 max-w-[85%] shadow-sm">
                <p className="text-[11px] text-neutral-800">Carro pronto sexta às 15h ✅</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Floating phone — WhatsApp preview (desktop only) */}
      <div className="hidden md:block absolute -bottom-6 -right-4 w-44 h-72 rounded-[20px] border-4 border-foreground/80 bg-background shadow-2xl rotate-[6deg] overflow-hidden">
        <div className="h-5 bg-foreground/80" />
        <div className="p-2 bg-[#075E54] text-white flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[10px] font-semibold leading-tight">Maria Silva</p>
            <p className="text-[8px] opacity-80 leading-tight">online</p>
          </div>
        </div>
        <div className="p-2 space-y-1.5 bg-[#ECE5DD] h-[calc(100%-52px)]">
          <div className="bg-white rounded-lg p-1.5 max-w-[80%] shadow-sm">
            <p className="text-[9px] text-neutral-800">Orçamento #1042 pronto: €245</p>
          </div>
          <div className="bg-[#DCF8C6] rounded-lg p-1.5 max-w-[80%] shadow-sm ml-auto">
            <p className="text-[9px] text-neutral-800 flex items-center gap-1">Aprovado <CheckCircle2 className="w-2.5 h-2.5 text-green-600" /></p>
          </div>
          <div className="bg-white rounded-lg p-1.5 max-w-[80%] shadow-sm">
            <p className="text-[9px] text-neutral-800">Carro pronto sexta às 15h ✅</p>
          </div>
        </div>
      </div>
    </div>
  );
}
