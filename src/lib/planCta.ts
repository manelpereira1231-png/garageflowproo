/**
 * FONTE ÚNICA DE VERDADE para os botões dos planos (CTAs).
 *
 * ✅ TODA a plataforma passa por aqui: Landing, Billing, Comparador, Checkout,
 *    promoções, dashboard admin, e-mails HTML e páginas públicas.
 * ❌ Nunca hardcode "Testar Plano Pro" / "Upgrade para Garage" em componentes.
 * ❌ Nunca `if (plan === "pro")` ou `switch(plan)` a decidir label ou destino.
 *
 * O texto vem do próprio plano (`plans.cta_label`). Se o admin deixar vazio,
 * é derivado do nome do plano + modo (`cta_mode`). O destino é derivado do modo
 * (ou de `cta_url` para `custom_url`). Alterar o CTA no Super Admin propaga-se
 * imediatamente por toda a app graças ao realtime em `plans`.
 */
import type { PlanRow, PlanCtaMode } from "@/hooks/usePlansCatalog";

export type PlanCtaSurface = "landing" | "billing" | "checkout" | "compare";
export type PlanCtaContext = "anon" | "current" | "upgrade" | "downgrade";

export interface ResolvedPlanCta {
  /** Texto do botão pronto para renderizar. */
  label: string;
  /** Destino (route interna, URL externa ou string vazia se disabled). */
  href: string;
  /** Se o botão deve ser mostrado (plans.show_button). */
  visible: boolean;
  /** Se está desativado (unavailable, plano atual, sem destino). */
  disabled: boolean;
  /** Se `href` é externo (deve abrir com `<a>` em vez de `<Link>`). */
  external: boolean;
  /** Modo original (para lógica de checkout Stripe vs. redirect simples). */
  mode: PlanCtaMode;
}

/** Nome mostrado ao utilizador — nunca o slug. */
function displayName(plan: PlanRow): string {
  return (plan.label && plan.label.trim()) || (plan.name && plan.name.trim()) || plan.slug;
}

/**
 * Wrapper defensivo em torno de `t()`.
 *
 * O `t()` do `LanguageContext` devolve a **própria key** quando a tradução
 * não existe (`return … || key`). Isso quebra qualquer padrão
 * `t(key) || "fallback"` — a key crua é sempre truthy e o utilizador vê
 * `cta.tryPlan` na UI. Aqui detetamos esse caso e devolvemos `undefined`
 * para que o fallback humano tome o seu lugar. Também aplicamos
 * interpolação de variáveis `{name}` que o `t()` não suporta nativamente.
 */
function tr(
  t: ((k: string) => string) | undefined,
  key: string,
  vars?: Record<string, string>,
): string | undefined {
  if (!t) return undefined;
  const raw = t(key);
  if (!raw || raw === key) return undefined; // tradução em falta
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/**
 * Texto por defeito quando o admin não configurou `cta_label`.
 * Deriva SEMPRE do nome do plano + modo. Zero referências a slugs.
 * Traduções ficam em `tr()` opcional; se ausente usa fallback PT-PT.
 */
function defaultLabel(plan: PlanRow, ctx: PlanCtaContext, t?: (k: string) => string): string {
  const name = displayName(plan);
  const mode = plan.cta_mode;

  // Contexto tem prioridade sobre o modo — "plano atual" e "downgrade" são
  // etiquetas de estado, não de intenção comercial.
  if (ctx === "current") return tr(t, "cta.currentPlan") ?? "Plano Atual";
  if (ctx === "downgrade") return tr(t, "cta.downgrade", { name }) ?? `Mudar para ${name}`;

  switch (mode) {
    case "demo":
      return tr(t, "cta.demo") ?? "Marcar Demonstração";
    case "contact":
      return tr(t, "cta.contact") ?? "Contactar Comercial";
    case "unavailable":
      return tr(t, "cta.unavailable") ?? "Indisponível";
    case "custom_url":
      return tr(t, "cta.openPlan", { name }) ?? name;
    case "checkout":
      return ctx === "upgrade"
        ? (tr(t, "cta.upgrade", { name }) ?? `Passar para ${name}`)
        : (tr(t, "cta.subscribe", { name }) ?? `Subscrever ${name}`);
    case "trial":
    default:
      return ctx === "upgrade"
        ? (tr(t, "cta.upgrade", { name }) ?? `Passar para ${name}`)
        : (tr(t, "cta.tryPlan", { name }) ?? `Testar Plano ${name}`);
  }
}

/** Destino canónico por modo. */
function defaultHref(plan: PlanRow, ctx: PlanCtaContext, surface: PlanCtaSurface): { href: string; external: boolean; disabled: boolean } {
  const mode = plan.cta_mode;
  if (mode === "unavailable") return { href: "", external: false, disabled: true };
  if (ctx === "current") return { href: "", external: false, disabled: true };

  if (mode === "custom_url") {
    const url = (plan.cta_url || "").trim();
    if (!url) return { href: "", external: false, disabled: true };
    const external = /^https?:\/\//i.test(url);
    return { href: url, external, disabled: false };
  }

  if (mode === "demo" || mode === "contact") {
    return { href: "/demo", external: false, disabled: false };
  }

  // checkout & trial:
  // - Em Billing chamamos handler in-place (create-checkout) — o href não é usado;
  //   devolvemos "/billing" como fallback semanticamente correto.
  // - Nas restantes superfícies, o utilizador ainda não está autenticado / não
  //   está no fluxo de subscrição, portanto vai para o registo.
  if (surface === "billing") return { href: "/billing", external: false, disabled: false };
  return { href: "/auth?mode=signup", external: false, disabled: false };
}

/**
 * Resolve o CTA final de um plano.
 *
 * @param plan plano do catálogo (PlanRow)
 * @param opts.surface onde o botão vai ser desenhado
 * @param opts.context relação do utilizador atual com este plano
 * @param opts.t função de tradução (opcional)
 */
export function resolvePlanCta(
  plan: PlanRow,
  opts: { surface: PlanCtaSurface; context?: PlanCtaContext; t?: (k: string, vars?: Record<string, string>) => string } = { surface: "landing" },
): ResolvedPlanCta {
  const ctx: PlanCtaContext = opts.context ?? "anon";

  // 1) Texto: cta_label (admin) tem prioridade absoluta; caso contrário, gerado.
  const customLabel = (plan.cta_label || "").trim();
  const label = customLabel || defaultLabel(plan, ctx, opts.t);

  // 2) Destino
  const { href, external, disabled } = defaultHref(plan, ctx, opts.surface);

  const visible = plan.show_button !== false && (ctx !== "current" || opts.surface !== "landing");

  return {
    label,
    href,
    visible,
    disabled: disabled || (ctx === "current"),
    external,
    mode: plan.cta_mode,
  };
}

/**
 * Rótulo curto do selo (badge) — "Mais Popular" por defeito quando o admin
 * marca o plano como destacado mas não escreveu texto.
 */
export function resolvePlanBadge(plan: PlanRow, t?: (k: string) => string): string | null {
  if (plan.show_badge === false) return null;
  const custom = (plan.badge_label || "").trim();
  if (custom) return custom;
  return null; // sem badge se nada estiver configurado
}
