/**
 * DEMO ANALYTICS — tracking da experiência /demo e /demo-demonstracao.
 *
 * Regista eventos em public.demo_events (sessão, origem, páginas, cliques,
 * saída, CTA) para o painel admin perceber como a demo é usada.
 * Fire-and-forget: nunca bloqueia a UX nem lança erros.
 */
import { supabase } from "@/integrations/supabase/client";

const DEMO_SESSION_KEY = "gf_demo_session";
const DEMO_ENTERED_KEY = "gf_demo_entered";
const DEMO_MODE_KEY = "gf_sales_demo_mode";

export type DemoEventName =
  | "enter"
  | "page_view"
  | "click"
  | "plan_switch"
  | "exit"
  | "cta_signup"
  | "demo_end";

function getDemoSessionId(): string {
  try {
    let id = sessionStorage.getItem(DEMO_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
      sessionStorage.setItem(DEMO_SESSION_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function demoMode(): string {
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === "sales" ? "sales" : "self";
  } catch {
    return "self";
  }
}

function inferSource(referrer: string): string {
  if (!referrer) return "";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes("google.")) return "google";
    if (host.includes("bing.")) return "bing";
    if (host.includes("facebook.") || host.includes("fb.")) return "facebook";
    if (host.includes("instagram.")) return "instagram";
    if (host.includes("linkedin.")) return "linkedin";
    if (host.includes("youtube.")) return "youtube";
    if (host.includes("tiktok.")) return "tiktok";
    return host;
  } catch {
    return "";
  }
}

/** Regista um evento da demo. Nunca lança. */
export function trackDemoEvent(
  event: DemoEventName,
  opts: { path?: string; label?: string; metadata?: Record<string, unknown> } = {},
): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    void (supabase as any).from("demo_events").insert({
      session_id: getDemoSessionId(),
      mode: demoMode(),
      event,
      path: opts.path ?? window.location.pathname,
      label: (opts.label ?? "").slice(0, 120),
      source: params.get("utm_source") || inferSource(document.referrer),
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      referrer: (document.referrer || "").slice(0, 500),
      device_type: isMobile ? "mobile" : "desktop",
      metadata: opts.metadata ?? {},
    }).then(() => {}, () => {});
  } catch {
    /* swallow */
  }
}

/** Entrada na demo — uma vez por sessão do browser. */
export function trackDemoEnter(): void {
  try {
    if (sessionStorage.getItem(DEMO_ENTERED_KEY) === "1") return;
    sessionStorage.setItem(DEMO_ENTERED_KEY, "1");
  } catch {
    /* continuar mesmo sem storage */
  }
  trackDemoEvent("enter");
}
