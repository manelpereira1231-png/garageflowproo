/**
 * Palco visual da Sales Demo — réplica estática do ERP GarageFlow
 * (menu lateral real, topbar, e o ecrã de cada etapa) com dados fictícios
 * (AutoPrime Lisboa). NÃO lê nem escreve dados reais.
 */
import {
  Car, User, FileText, Wrench, Package, ListChecks, TrendingUp, Check,
  Clock, Euro, CalendarDays, ShieldCheck, LayoutDashboard, Users, HardHat,
  Receipt, Bell, MessageCircle, Search, Settings, Plus, Filter, Zap,
  PanelLeftClose, Star, Sun, LifeBuoy, Globe, LogOut, ChevronRight, Sparkles,
  Building2, ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ── Menu lateral (mesmos grupos e nomes do ERP real) ─────────────── */
const NAV: { group: string; items: { label: string; icon: any }[] }[] = [
  { group: "Operação Diária", items: [
    { label: "Clientes", icon: Users },
    { label: "Veículos", icon: Car },
    { label: "Orçamentos", icon: FileText },
    { label: "Serviços", icon: Wrench },
    { label: "Modo Oficina", icon: HardHat },
    { label: "Agenda", icon: CalendarDays },
  ]},
  { group: "Inventário", items: [{ label: "Stock", icon: Package }] },
  { group: "Faturação", items: [
    { label: "Faturas", icon: Receipt },
    { label: "Relatórios", icon: TrendingUp },
  ]},
  { group: "Comunicação", items: [
    { label: "Alertas", icon: Bell },
    { label: "Chat", icon: MessageCircle },
  ]},
  { group: "Crescimento", items: [{ label: "Automações", icon: Zap }] },
];

/**
 * Janela do ERP — réplica fiel do Layout real: sidebar (tokens `sidebar-*`,
 * item ativo em laranja sólido, personalizar, Lite/Pro, workspace, idioma e
 * sair) + topbar (nome da oficina, pesquisa ⌘K, ajuda, tema, notificações,
 * agenda). Sempre em tema escuro, como a aplicação.
 */
const AppWindow = ({
  active, title, subtitle, action, children,
}: {
  active: string; title: string; subtitle?: string; action?: string;
  children: React.ReactNode;
}) => (
  <div className="dark rounded-xl border border-border bg-background text-foreground overflow-hidden shadow-lg">
    {/* barra do browser */}
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
      <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
      <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
      <span className="ml-2 text-[11px] text-muted-foreground truncate">
        app.garageflow.pt — AutoPrime Lisboa
      </span>
    </div>

    <div className="flex">
      {/* menu lateral real */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="h-12 flex items-center gap-2.5 px-3 border-b border-sidebar-border">
          <img src="/icon-192-v8.png" alt="GarageFlow" className="w-7 h-7 rounded-lg object-contain shrink-0" />
          <span className="text-sm font-bold tracking-tight truncate">
            Garage<span className="text-sidebar-primary">Flow</span>
          </span>
          <PanelLeftClose className="w-3.5 h-3.5 ml-auto text-sidebar-foreground/60" />
        </div>

        <div className="flex-1 py-2 px-2">
          <div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
            active === "Dashboard"
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
              : "text-sidebar-foreground"}`}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            {active === "Dashboard" && <ChevronRight className="w-3 h-3 ml-auto" />}
          </div>
          {NAV.map((g) => (
            <div key={g.group} className="mt-2">
              <p className="px-2.5 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/50 mb-0.5">{g.group}</p>
              {g.items.map((it) => (
                <div key={it.label} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                  it.label === active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                    : "text-sidebar-foreground"}`}>
                  <it.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{it.label}</span>
                  {it.label === active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </div>
              ))}
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-sidebar-foreground">
            <Settings className="w-3.5 h-3.5" /> Definições
          </div>
        </div>

        {/* Personalizar */}
        <div className="px-2 py-1.5 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-sidebar-foreground/80">
            <Star className="w-3.5 h-3.5" /> Personalizar
          </div>
        </div>

        {/* Toggle Lite/Pro */}
        <div className="px-2 py-1.5 border-t border-sidebar-border">
          <div className="flex items-center justify-between rounded-lg bg-sidebar-accent px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-sidebar-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-sidebar-primary" /> Lite
            </span>
            <span className="rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-bold px-1.5 py-0.5">Pro</span>
          </div>
        </div>

        {/* Workspace (oficina ativa) */}
        <div className="px-2 py-1.5 border-t border-sidebar-border">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-2.5 py-1.5 text-[11px] text-sidebar-foreground">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">AutoPrime Lisboa</span>
            <ChevronsUpDown className="w-3 h-3 ml-auto opacity-70" />
          </div>
        </div>

        {/* Idioma */}
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-2.5 py-1.5 text-[11px] text-sidebar-foreground">
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">🇵🇹 Português</span>
            <ChevronsUpDown className="w-3 h-3 ml-auto opacity-70" />
          </div>
        </div>

        {/* Sair */}
        <div className="px-2 py-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </div>
        </div>
      </aside>

      {/* conteúdo */}
      <div className="flex-1 min-w-0">
        {/* topbar — igual à app */}
        <div className="h-12 flex items-center gap-2 px-3 border-b border-border bg-card/70">
          <span className="text-[11px] font-medium text-muted-foreground truncate hidden lg:block">AutoPrime Lisboa</span>
          <div className="flex-1 flex justify-center px-2 min-w-0">
            <div className="flex items-center gap-1.5 w-full max-w-[260px] rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
              <Search className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1">Pesquisar…</span>
              <kbd className="text-[9px] font-mono border border-border/60 rounded px-1 py-0.5">⌘K</kbd>
            </div>
          </div>
          <LifeBuoy className="w-4 h-4 text-muted-foreground" />
          <Sun className="w-4 h-4 text-muted-foreground" />
          <Bell className="w-4 h-4 text-muted-foreground" />
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">AP</div>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
            {action && (
              <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1.5">
                <Plus className="w-3 h-3" /> {action}
              </span>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  </div>
);

/** Legenda numerada: explica o que é cada elemento do ecrã. */
const Legend = ({ items }: { items: string[] }) => (
  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
    {items.map((t, i) => (
      <div key={t} className="flex gap-2 text-[11px] text-muted-foreground">
        <span className="w-4 h-4 shrink-0 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
        <span>{t}</span>
      </div>
    ))}
  </div>
);

const Marker = ({ n }: { n: number }) => (
  <span className="inline-flex w-4 h-4 shrink-0 rounded-full bg-primary text-primary-foreground text-[9px] font-bold items-center justify-center align-middle">{n}</span>
);

const Kpi = ({ label, value, sub, n }: any) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
      {n && <Marker n={n} />}{label}
    </p>
    <p className="text-xl font-bold mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-primary mt-0.5">{sub}</p>}
  </div>
);

const TH = ({ cols }: { cols: string[] }) => (
  <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border">
    {cols.map((c) => <span key={c} className="truncate">{c}</span>)}
  </div>
);

const Row = ({ cols, muted }: { cols: React.ReactNode[]; muted?: boolean }) => (
  <div className={`grid grid-cols-4 gap-2 px-3 py-2 text-sm border-b border-border last:border-0 ${muted ? "text-muted-foreground" : ""}`}>
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
        <>
          <AppWindow active="Dashboard" title="Dashboard" subtitle="Agosto 2026 · AutoPrime Lisboa">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi n={1} label="Serviços do mês" value="38" sub="+12% vs mês anterior" />
              <Kpi n={2} label="Faturado" value="14 250 €" sub="+8%" />
              <Kpi n={3} label="Orçamentos por aprovar" value="6" sub="2 490 € em jogo" />
              <Kpi n={4} label="Viaturas na oficina" value="9" sub="3 prontas a entregar" />
            </div>
            <div className="mt-4 rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border text-xs font-semibold flex items-center gap-2">
                <Marker n={5} /> Serviços recentes
              </div>
              <TH cols={["Nº", "Viatura", "Estado", "Valor"]} />
              <Row cols={["OS-2041", "Golf VII · 12-AB-34", <Badge className="text-[10px]">Em reparação</Badge>, "480,00 €"]} />
              <Row cols={["OS-2040", "Clio IV · 45-CD-67", <Badge variant="secondary" className="text-[10px]">Aguarda aprovação</Badge>, "215,50 €"]} />
              <Row cols={["OS-2039", "Astra · 89-EF-01", <Badge variant="outline" className="text-[10px]">Entregue</Badge>, "132,90 €"]} muted />
            </div>
          </AppWindow>
          <Legend items={[
            "Serviços do mês: quantos trabalhos a oficina fechou, comparados com o mês anterior.",
            "Faturado: dinheiro faturado no mês, somado automaticamente a partir das faturas emitidas.",
            "Orçamentos por aprovar: dinheiro que está à espera de uma resposta do cliente.",
            "Viaturas na oficina: carros que estão fisicamente lá dentro, e quantos já podem sair.",
            "Serviços recentes: os últimos trabalhos com o estado atual — clicando abre a ficha.",
          ]} />
        </>
      );

    case "client":
      return (
        <>
          <AppWindow active="Clientes" title="Rui Marques" subtitle="Ficha de cliente" action="Novo cliente">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="font-semibold flex items-center gap-1.5"><Marker n={1} /> Rui Marques</p>
                <p className="text-xs text-muted-foreground truncate">912 000 000 · rui@exemplo.pt · NIF 500 000 000</p>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0">Cliente desde 2022</Badge>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
              <Kpi n={2} label="Viaturas" value="2" />
              <Kpi n={3} label="Serviços" value="11" />
              <Kpi n={4} label="Total faturado" value="3 180 €" />
            </div>
          </AppWindow>
          <Legend items={[
            "Contactos do cliente: telefone, email e NIF usados nos orçamentos e faturas — escritos uma só vez.",
            "Viaturas: todos os carros deste cliente ficam ligados à ficha dele.",
            "Serviços: quantas intervenções já fez na oficina.",
            "Total faturado: quanto vale este cliente desde que entrou.",
          ]} />
        </>
      );

    case "vehicle":
      return (
        <>
          <AppWindow active="Viaturas" title="12-AB-34 · VW Golf VII 1.6 TDI" subtitle="Ficha da viatura" action="Nova viatura">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center"><Car className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="font-semibold flex items-center gap-1.5"><Marker n={1} /> 12-AB-34 · VW Golf VII</p>
                <p className="text-xs text-muted-foreground">2016 · Diesel · 187 400 km · Proprietário: Rui Marques</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <Kpi n={2} label="Última visita" value="03/2026" />
              <Kpi n={3} label="Próxima revisão" value="09/2026" />
              <Kpi n={4} label="Intervenções" value="7" />
            </div>
          </AppWindow>
          <Legend items={[
            "Identificação da viatura: matrícula, marca, ano, combustível e quilómetros atuais.",
            "Última visita: quando o carro esteve cá pela última vez.",
            "Próxima revisão: a data que o sistema usa para avisar o cliente sozinho.",
            "Intervenções: número de trabalhos feitos nesta viatura.",
          ]} />
        </>
      );

    case "history":
      return (
        <>
          <AppWindow active="Viaturas" title="Histórico · 12-AB-34" subtitle="Todas as intervenções desta viatura">
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
          </AppWindow>
          <Legend items={[
            "Cada linha é um trabalho já feito, com data, descrição e valor cobrado.",
            "O histórico fica na viatura: se o carro mudar de dono ou de técnico, a informação não se perde.",
          ]} />
        </>
      );

    case "quote":
      return (
        <>
          <AppWindow active="Orçamentos" title="Orçamento ORC-2026/118" subtitle="Golf VII · 12-AB-34 · Rui Marques" action="Novo orçamento">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Enviado a 18/08/2026</span>
              <Badge className="flex items-center gap-1.5"><Marker n={2} />Aguarda aprovação</Badge>
            </div>
            <div className="mt-3 rounded-lg border border-border text-sm overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border flex items-center gap-1.5">
                <Marker n={1} /> Linhas do orçamento
              </div>
              {[["Mão de obra (2h × 45 €)", "90,00 €"], ["Pastilhas travão", "62,40 €"], ["Discos travão", "98,00 €"]].map(([a, b]) => (
                <div key={a} className="flex justify-between px-3 py-2 border-b border-border last:border-0">
                  <span>{a}</span><span className="whitespace-nowrap">{b}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 font-semibold">
              <span>Total c/ IVA</span><span className="text-primary">308,50 €</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Marker n={3} /><ShieldCheck className="w-3.5 h-3.5" /> Enviado por email/WhatsApp com aprovação digital.
            </p>
          </AppWindow>
          <Legend items={[
            "Linhas: mão de obra calculada pelas horas e preço/hora da oficina, mais as peças do stock.",
            "Estado: mostra se o cliente já respondeu — sem telefonemas a perguntar.",
            "Envio e aprovação: o cliente aprova no telemóvel e fica registada a assinatura digital.",
          ]} />
        </>
      );

    case "parts":
      return (
        <>
          <AppWindow active="Stock" title="Stock" subtitle="Peças consumidas na OS-2041">
            {[["Pastilhas travão FR", "4", "12 → 8"], ["Discos travão", "2", "6 → 4"], ["Óleo 5W30 (L)", "4", "38 → 34"]].map(([p, q, s]) => (
              <div key={p} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1">{p}</span>
                <span className="text-muted-foreground">x{q}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{s}</span>
              </div>
            ))}
          </AppWindow>
          <Legend items={[
            "Quantidade usada no serviço — registada pelo técnico enquanto trabalha.",
            "Stock antes → depois: o inventário desce sozinho, sem contagens manuais.",
            "Quando a peça chega ao mínimo definido, o sistema avisa para encomendar.",
          ]} />
        </>
      );

    case "services":
    case "repair":
      return (
        <>
          <AppWindow active="Serviços" title="Serviços" subtitle="Trabalhos em curso na oficina" action="Novo serviço">
            <div className="rounded-lg border border-border p-3 mb-3">
              <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1.5"><Marker n={1} /> OS-2041 · Golf VII — estado da reparação</p>
              <Timeline active={step === "repair" ? 3 : 2} />
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <TH cols={["Nº", "Viatura", "Estado", "Valor"]} />
              <Row cols={["OS-2041", "Golf VII", <Badge className="text-[10px]">Reparação</Badge>, "480,00 €"]} />
              <Row cols={["OS-2040", "Clio IV", <Badge variant="secondary" className="text-[10px]">Aprovação</Badge>, "215,50 €"]} muted />
              <Row cols={["OS-2038", "Astra", <Badge variant="outline" className="text-[10px]">Diagnóstico</Badge>, "—"]} muted />
            </div>
          </AppWindow>
          <Legend items={[
            "A barra de estados mostra em que fase está o carro, da receção à entrega.",
            "Cada avanço de estado pode avisar o cliente automaticamente.",
            "A lista mostra tudo o que está aberto na oficina, com o valor associado.",
          ]} />
        </>
      );

    case "tasks":
      return (
        <>
          <AppWindow active="Modo Oficina" title="Modo Oficina" subtitle="Vista do técnico — no telemóvel ou tablet">
            {[["Substituir pastilhas — OS-2041", "Em curso"], ["Diagnóstico eletrónico — OS-2038", "Por iniciar"], ["Mudança de óleo — OS-2037", "Concluída"]].map(([t, s]) => (
              <div key={t} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
                <ListChecks className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1">{t}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{s}</Badge>
              </div>
            ))}
          </AppWindow>
          <Legend items={[
            "Cada técnico vê apenas as tarefas que lhe foram atribuídas.",
            "Ao marcar como concluída, o serviço avança e o escritório vê logo.",
          ]} />
        </>
      );

    case "metrics":
      return (
        <>
          <AppWindow active="Relatórios" title="Relatórios financeiros" subtitle="Últimos 8 meses">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi n={1} label="Faturação (mês)" value="14 250 €" sub="+8%" />
              <Kpi n={2} label="Ticket médio" value="375 €" />
              <Kpi n={3} label="Taxa de aprovação" value="74%" />
              <Kpi n={4} label="Serviços/dia" value="1,8" />
            </div>
            <div className="mt-4 flex items-end gap-1.5 h-24">
              {[40, 55, 48, 70, 62, 85, 78, 96].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Evolução mensal (dados fictícios).</p>
          </AppWindow>
          <Legend items={[
            "Faturação do mês: soma real das faturas emitidas no período.",
            "Ticket médio: quanto vale, em média, cada serviço — ajuda a definir preços.",
            "Taxa de aprovação: percentagem de orçamentos que o cliente aceitou.",
            "Serviços/dia: ritmo da oficina, útil para perceber capacidade.",
          ]} />
        </>
      );

    case "notify":
      return (
        <>
          <AppWindow active="Alertas" title="Notificação e aprovação" subtitle="ORC-2026/118 · Rui Marques">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* telemóvel do cliente */}
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Marker n={1} /> O que o cliente recebe
                </p>
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <MessageCircle className="w-3.5 h-3.5 text-primary" /> AutoPrime Lisboa
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Olá Rui, o orçamento para o Golf VII (12-AB-34) está pronto: 308,50 € c/ IVA.
                    Pode aprovar aqui.
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1.5">
                      <Check className="w-3 h-3" /> Aprovar
                    </span>
                    <span className="inline-flex items-center rounded-md border border-border text-[11px] px-2.5 py-1.5 text-muted-foreground">
                      Recusar
                    </span>
                  </div>
                </div>
              </div>

              {/* lado da oficina */}
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Marker n={2} /> O que a oficina vê
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1">Orçamento ORC-2026/118 aprovado</span>
                    <Badge className="text-[10px] shrink-0">Novo</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-xs">18/08/2026 · 16:24 · aprovação digital registada</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="text-xs">Assinatura do cliente guardada com o documento</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                  <Marker n={3} /> O serviço OS-2041 é criado a partir do orçamento aprovado.
                </p>
              </div>
            </div>
          </AppWindow>
          <Legend items={[
            "O cliente recebe o orçamento por email e WhatsApp e responde no telemóvel.",
            "A oficina é notificada de imediato — sem telefonemas a perguntar.",
            "A aprovação fica registada com data, hora e assinatura digital, e dá origem ao serviço.",
          ]} />
        </>
      );

    case "conversion":

      return (
        <>
          <AppWindow active="Definições" title="Arranque" subtitle="O que acontece depois de dizer que sim">
            <div className="space-y-2 text-sm">
              {["Criar conta da oficina", "Importar clientes e viaturas (Excel/CSV)", "Emitir o primeiro orçamento", "Acompanhar a primeira reparação"].map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Normalmente no mesmo dia.</p>
          </AppWindow>
        </>
      );

    default:
      return null;
  }
}

export { Euro, Wrench, Filter };
