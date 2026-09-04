/**
 * DEMO GUIDE — camada de orientação da conta de demonstração.
 *
 * Só é montada em sessões demo (gf_sales_demo=1). Não altera a app real:
 * apenas sobrepõe boas-vindas, visita guiada com spotlight sobre o menu real,
 * checklist de exploração e CTA de conversão.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Car, ChevronLeft, ChevronRight, Check, X, Sparkles, Rocket, PartyPopper, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDemoSession, exitDemoToSignup } from "@/lib/salesDemo";
import { trackDemoEvent } from "@/lib/demoTracker";

const K_WELCOME = "gf_demo_guide_seen";
const K_TOUR = "gf_demo_tour_done";
const K_CHECK = "gf_demo_checklist";
const K_CHECK_HIDDEN = "gf_demo_checklist_hidden";

type Step = { path: string; title: string; body: string };

const STEPS: Step[] = [
  { path: "/dashboard", title: "Comece aqui", body: "Acompanhe num único local o estado da sua oficina, serviços, orçamentos e atividade recente." },
  { path: "/clients", title: "Clientes organizados", body: "Tenha os dados dos seus clientes organizados e associados às respetivas viaturas." },
  { path: "/vehicles", title: "Histórico de cada viatura", body: "Consulte rapidamente as viaturas, histórico e informação associada a cada cliente." },
  { path: "/quotes", title: "Crie e envie orçamentos", body: "Crie orçamentos profissionais e acompanhe o estado de cada orçamento." },
  { path: "/services", title: "Controle cada reparação", body: "Acompanhe o trabalho desde a entrada da viatura até à conclusão da reparação." },
  { path: "/notifications", title: "Comunique com os clientes", body: "Centralize as comunicações e acompanhe as notificações relacionadas com os trabalhos." },
];

const CHECKLIST: { path: string; label: string }[] = [
  { path: "/clients", label: "Consultar um cliente" },
  { path: "/vehicles", label: "Abrir uma viatura" },
  { path: "/quotes", label: "Ver um orçamento" },
  { path: "/services", label: "Consultar uma ordem de reparação" },
  { path: "/notifications", label: "Ver as notificações" },
];

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } };

function useTargetRect(path: string | null, tick: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!path) { setRect(null); return; }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${path}"]`);
      if (!el) { setRect(null); return; }
      const box = el.getBoundingClientRect();
      if (box.top < 8 || box.bottom > window.innerHeight - 8) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const r = el.getBoundingClientRect();
      setRect(r.width > 0 && r.height > 0 && r.top < window.innerHeight ? r : null);
    };
    raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 220);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [path, tick]);
  return rect;
}

export default function DemoGuide() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = isDemoSession();

  const [welcome, setWelcome] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [finalStep, setFinalStep] = useState(false);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[]>(() => {
    try { return JSON.parse(read(K_CHECK) || "[]"); } catch { return []; }
  });
  const [checklistHidden, setChecklistHidden] = useState(() => read(K_CHECK_HIDDEN) === "1");
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (!read(K_WELCOME)) setWelcome(true);
  }, [active]);

  // Marca automaticamente os itens visitados
  useEffect(() => {
    if (!active) return;
    const hit = CHECKLIST.find((c) => location.pathname.startsWith(c.path));
    if (!hit || done.includes(hit.path)) return;
    const next = [...done, hit.path];
    setDone(next);
    write(K_CHECK, JSON.stringify(next));
  }, [active, location.pathname, done]);

  const allDone = done.length >= CHECKLIST.length;
  useEffect(() => { if (allDone) setCelebrated(true); }, [allDone]);

  const step = tourStep !== null ? STEPS[tourStep] : null;
  const rect = useTargetRect(step?.path ?? null, tick);

  const goStep = useCallback((i: number) => {
    const s = STEPS[i];
    setTourStep(i);
    if (s && location.pathname !== s.path) navigate(s.path);
    setTick((t) => t + 1);
  }, [navigate, location.pathname]);

  const startTour = () => {
    write(K_WELCOME, "1");
    setWelcome(false);
    trackDemoEvent("click", { label: "demo_tour_start" });
    goStep(0);
  };

  const closeTour = (reason: string) => {
    setTourStep(null); setFinalStep(false);
    write(K_TOUR, "1");
    trackDemoEvent("click", { label: `demo_tour_${reason}` });
  };

  const signup = async () => {
    setBusy(true);
    trackDemoEvent("click", { label: "demo_guide_signup" });
    await exitDemoToSignup();
  };

  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    const W = 360;
    if (!rect || window.innerWidth < 768) {
      return { left: "50%", bottom: 16, transform: "translateX(-50%)", width: `min(${W}px, calc(100vw - 24px))` };
    }
    const left = Math.min(rect.right + 16, window.innerWidth - W - 16);
    const top = Math.min(Math.max(rect.top - 8, 16), window.innerHeight - 260);
    return { left, top, width: W };
  }, [rect, tick]);

  if (!active) return null;

  const overlay = (
    <>
      {/* Indicador permanente de conta demo (apenas desktop — em mobile
          o estado demo é mostrado na barra inferior, evitando sobreposições) */}
      <div className="pointer-events-none fixed top-2 left-1/2 z-[70] hidden -translate-x-1/2 md:block">
        <span className="rounded-full border border-primary/40 bg-background/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary shadow-sm backdrop-blur">
          Conta Demo · Dados fictícios
        </span>
      </div>

      {/* Boas-vindas */}
      {welcome && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Car className="h-5 w-5" /></span>
              <h2 className="text-lg font-bold leading-tight">Bem-vindo à demonstração do GarageFlow</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Esta é uma conta de demonstração com dados fictícios. Explore livremente para perceber como o
              GarageFlow pode ajudar a gerir uma oficina de forma mais simples e organizada.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button className="min-h-11 flex-1 font-semibold" onClick={startTour}>
                <Sparkles className="mr-2 h-4 w-4" />Começar visita guiada
              </Button>
              <Button
                variant="outline" className="min-h-11 flex-1"
                onClick={() => { write(K_WELCOME, "1"); setWelcome(false); trackDemoEvent("click", { label: "demo_explore_free" }); }}
              >
                Explorar livremente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Visita guiada */}
      {step && !finalStep && (
        <div className="fixed inset-0 z-[85]">
          {rect ? (
            <>
              <div
                className="pointer-events-none absolute rounded-xl transition-all duration-200"
                style={{
                  left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12,
                  boxShadow: "0 0 0 9999px hsl(var(--background) / 0.92), 0 0 0 3px hsl(var(--primary)), 0 0 28px 6px hsl(var(--primary) / 0.55)",
                }}
              />
              <div
                className="pointer-events-none absolute animate-ping rounded-xl border-2 border-primary/70"
                style={{ left: rect.left - 10, top: rect.top - 10, width: rect.width + 20, height: rect.height + 20 }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-background/92" />
          )}

          <div className="absolute rounded-2xl border-2 border-primary/60 bg-card p-5 shadow-[0_20px_60px_-10px_hsl(var(--primary)/0.45)] ring-1 ring-primary/20" style={tooltipStyle}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Passo {tourStep! + 1} de {STEPS.length + 1}
              </span>
              <button onClick={() => closeTour("skip")} aria-label="Sair da visita" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((tourStep! + 1) / (STEPS.length + 1)) * 100}%` }} />
            </div>
            <h3 className="text-lg font-bold leading-tight">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="ghost" size="sm" className="min-h-10" disabled={tourStep === 0} onClick={() => goStep(tourStep! - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />Voltar
              </Button>
              <Button variant="ghost" size="sm" className="min-h-10 text-muted-foreground" onClick={() => closeTour("exit")}>
                Sair da visita
              </Button>
              <Button
                size="sm" className="ml-auto min-h-10 font-semibold"
                onClick={() => (tourStep! < STEPS.length - 1 ? goStep(tourStep! + 1) : setFinalStep(true))}
              >
                {tourStep! < STEPS.length - 1 ? "Avançar" : "Terminar"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Passo final — conversão */}
      {finalStep && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Passo {STEPS.length + 1} de {STEPS.length + 1}</span>
            <h2 className="mt-2 text-lg font-bold leading-tight">Pronto para utilizar o GarageFlow na sua oficina?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Esta demonstração utiliza dados fictícios. Se quiser começar a utilizar o GarageFlow com a sua oficina,
              podemos criar a sua conta e ajudá-lo a configurar tudo.
            </p>
            <p className="mt-2 text-xs font-medium text-primary">Comece gratuitamente. Sem cartão.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button className="min-h-11 flex-1 font-semibold" disabled={busy} onClick={signup}>
                <Rocket className="mr-2 h-4 w-4" />Criar a minha conta
              </Button>
              <Button variant="outline" className="min-h-11 flex-1" onClick={() => closeTour("continue")}>
                Continuar a explorar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist + CTA permanente */}
      {!welcome && tourStep === null && !checklistHidden && (
        <div className="fixed bottom-[6.5rem] right-3 z-30 w-[min(280px,calc(100vw-1.5rem))] rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur md:bottom-3 md:z-[60]">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold">Explore o GarageFlow</span>
            <button
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Fechar checklist"
              onClick={() => { setChecklistHidden(true); write(K_CHECK_HIDDEN, "1"); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {allDone && celebrated ? (
            <p className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <PartyPopper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Já viu as principais funcionalidades do GarageFlow.
            </p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {CHECKLIST.map((c) => {
                const ok = done.includes(c.path);
                return (
                  <li key={c.path}>
                    <button
                      onClick={() => navigate(c.path)}
                      className={`flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:bg-accent/60 ${ok ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${ok ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {ok && <Check className="h-3 w-3" />}
                      </span>
                      {c.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">Está a gostar do GarageFlow? Crie a conta da sua oficina.</p>
          <Button size="sm" className="min-h-10 w-full font-semibold" disabled={busy} onClick={signup}>
            <Rocket className="mr-1.5 h-3.5 w-3.5" />Criar a minha conta
          </Button>
        </div>
      )}
    </>
  );

  return createPortal(overlay, document.body);
}
