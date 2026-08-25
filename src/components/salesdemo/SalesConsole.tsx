/**
 * SALES DEMO — Consola comercial (Fase 2).
 *
 * Painel lateral, opcional e discreto, que ajuda o comercial a conduzir a
 * conversa: perfil da oficina, necessidades, foco, guião, momentos de valor,
 * objeções, recomendação de plano e resumo copiável.
 *
 * Não altera Auth, Billing, subscrições nem dados reais. Todo o estado vive
 * em sessionStorage e desaparece no Reset da demonstração.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Lightbulb, MessageSquare, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLAN_LABEL, type DemoPlan } from "@/lib/salesDemo";
import {
  CONFIDENCE_LABEL, NEEDS, OBJECTIONS, SCRIPT, VALUE_MOMENTS,
  buildSummary, loadSalesState, needLabel, recommend, saveSalesState,
  type SalesState,
} from "@/lib/salesDemoSales";
import { trackEvent } from "@/lib/trackEvent";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: DemoPlan;
  priceLabel: (p: DemoPlan) => string;
  onSelectPlan: (p: DemoPlan) => void;
}

export default function SalesConsole({ open, onOpenChange, plan, priceLabel, onSelectPlan }: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<SalesState>(() => loadSalesState());
  const [objection, setObjection] = useState<string | null>(null);

  useEffect(() => { if (open) setState(loadSalesState()); }, [open]);

  const update = (patch: Partial<SalesState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveSalesState(next);
      return next;
    });
  };

  const toggleNeed = (id: string) => {
    const needs = state.needs.includes(id) ? state.needs.filter((n) => n !== id) : [...state.needs, id];
    update({ needs });
  };

  const markShown = (label: string) => {
    if (!state.shown.includes(label)) update({ shown: [...state.shown, label] });
  };

  const goTo = (route: string, label: string) => {
    markShown(label);
    onOpenChange(false);
    navigate(route);
  };

  const rec = useMemo(() => recommend(state), [state]);
  const recPrice = priceLabel(rec.plan);

  const focus = useMemo(() => state.needs.slice(0, 3).map(needLabel), [state.needs]);

  const nextStep =
    rec.plan === "garage"
      ? "Marcar demonstração dedicada / avançar pela página de planos"
      : "Avançar pela página de planos do GarageFlow";

  const copySummary = async () => {
    const text = buildSummary(state, rec, recPrice, nextStep);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumo copiado");
      trackEvent("sales_demo_summary_copied", { plan: rec.plan });
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  useEffect(() => {
    if (open) trackEvent("sales_demo_console_opened", { plan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" /> Consola comercial
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="perfil" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="perfil" className="text-xs">Perfil</TabsTrigger>
            <TabsTrigger value="guiao" className="text-xs">Guião</TabsTrigger>
            <TabsTrigger value="objecoes" className="text-xs">Objeções</TabsTrigger>
            <TabsTrigger value="fecho" className="text-xs">Fecho</TabsTrigger>
          </TabsList>

          {/* ── PERFIL + NECESSIDADES ─────────────────────────────── */}
          <TabsContent value="perfil" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Opcional. Preencha durante a conversa — nada é enviado para lado nenhum.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Oficina" value={state.profile.shopName}
                onChange={(e) => update({ profile: { ...state.profile, shopName: e.target.value } })} />
              <Input placeholder="Nº de pessoas" value={state.profile.people}
                onChange={(e) => update({ profile: { ...state.profile, people: e.target.value } })} />
              <Input placeholder="Nº de utilizadores" value={state.profile.users}
                onChange={(e) => update({ profile: { ...state.profile, users: e.target.value } })} />
              <Input placeholder="Viaturas/mês" value={state.profile.vehiclesMonth}
                onChange={(e) => update({ profile: { ...state.profile, vehiclesMonth: e.target.value } })} />
              <Input className="col-span-2" placeholder="Software atual" value={state.profile.currentSoftware}
                onChange={(e) => update({ profile: { ...state.profile, currentSoftware: e.target.value } })} />
              <Input className="col-span-2" placeholder="Principal dificuldade" value={state.profile.mainPain}
                onChange={(e) => update({ profile: { ...state.profile, mainPain: e.target.value } })} />
              <Input className="col-span-2" placeholder="O que procura melhorar" value={state.profile.goal}
                onChange={(e) => update({ profile: { ...state.profile, goal: e.target.value } })} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Necessidades</p>
              <div className="flex flex-wrap gap-1.5">
                {NEEDS.map((n) => {
                  const on = state.needs.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggleNeed(n.id)}
                      className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                        on ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {on && <Check className="w-3 h-3 inline mr-1 text-primary" />}
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {focus.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-semibold mb-1">Foco recomendado para esta oficina</p>
                <p className="text-xs text-muted-foreground mb-2">Prioridade: {focus.join(" + ")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {state.needs.map((id) => {
                    const n = NEEDS.find((x) => x.id === id)!;
                    return (
                      <Button key={id} size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => goTo(n.route, n.label)}>
                        {n.label}<ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Sugestão — o comercial mantém o controlo total.</p>
              </div>
            )}
          </TabsContent>

          {/* ── GUIÃO + VALOR ─────────────────────────────────────── */}
          <TabsContent value="guiao" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Sugestão para o comercial
              </p>
              {SCRIPT.map((s) => (
                <div key={s.area} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{s.area}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => goTo(s.route, s.area)}>
                      Mostrar<ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">“{s.line}”</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" /> Momentos de valor
              </p>
              {VALUE_MOMENTS.map((v) => (
                <div key={v.title} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.body}</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={() => goTo(v.route, v.title)}>
                    Mostrar na Demo<ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── OBJEÇÕES ──────────────────────────────────────────── */}
          <TabsContent value="objecoes" className="space-y-2 mt-4">
            {OBJECTIONS.map((o) => {
              const openObj = objection === o.id;
              return (
                <div key={o.id} className="rounded-lg border border-border">
                  <button
                    onClick={() => { setObjection(openObj ? null : o.id); if (!openObj) trackEvent("sales_demo_objection_opened", { objection: o.id }); }}
                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/40 rounded-lg"
                  >
                    {o.label}
                  </button>
                  {openObj && (
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-xs text-muted-foreground">{o.answer}</p>
                      <div className="flex flex-wrap gap-2">
                        {o.route && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => goTo(o.route!, o.label)}>
                            Mostrar na Demo<ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {(["free", "pro", "garage"] as DemoPlan[]).map((p) => (
                          <Button key={p} size="sm" variant={p === plan ? "default" : "ghost"} className="h-7 text-xs"
                            onClick={() => onSelectPlan(p)}>
                            {PLAN_LABEL[p]} · {priceLabel(p)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground pt-1">
              Enterprise: solução à medida — marcar demonstração dedicada.
            </p>
          </TabsContent>

          {/* ── FECHO ─────────────────────────────────────────────── */}
          <TabsContent value="fecho" className="space-y-4 mt-4">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano recomendado</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{PLAN_LABEL[rec.plan]}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{recPrice}</span>
              </div>
              <Badge variant="secondary" className="mt-2 text-[11px]">{CONFIDENCE_LABEL[rec.confidence]}</Badge>
              <ul className="mt-3 space-y-1.5">
                {rec.reasons.map((r) => (
                  <li key={r} className="text-xs flex gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />{r}
                  </li>
                ))}
              </ul>
              {rec.plan !== plan && (
                <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => onSelectPlan(rec.plan)}>
                  Mostrar o {PLAN_LABEL[rec.plan]} na Demo
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              {rec.belowNote && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold mb-1">O que ficaria de fora no plano abaixo</p>
                  <p className="text-xs text-muted-foreground">{rec.belowNote}</p>
                </div>
              )}
              {rec.aboveNote && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold mb-1">
                    {rec.plan === "free" ? "Quando faria sentido considerar o Pro" : "O que o plano acima acrescentaria no futuro"}
                  </p>
                  <p className="text-xs text-muted-foreground">{rec.aboveNote}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold mb-1">O que vimos hoje</p>
              {state.shown.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda sem áreas registadas.</p>
              ) : (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {state.shown.map((s) => <li key={s}>✓ {s}</li>)}
                </ul>
              )}
              {state.needs.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Necessidades: {state.needs.map(needLabel).join(", ")}
                </p>
              )}
            </div>

            <Textarea
              rows={3}
              placeholder="Notas internas (opcional)"
              value={state.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold mb-1">Próximo passo</p>
              <p className="text-xs text-muted-foreground">{nextStep}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => { trackEvent("sales_demo_cta_clicked", { plan: rec.plan }); goTo("/billing", "Planos"); }}>
                  Abrir planos
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copySummary}>
                  <Copy className="w-3.5 h-3.5 mr-1" />Copiar resumo
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
