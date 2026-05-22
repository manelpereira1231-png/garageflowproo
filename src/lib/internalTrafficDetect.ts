// Deteta tráfego interno (admin, dev, lovable preview, localhost, bots).
// Não depende só de IP. Combina vários sinais para classificar.

export type TrafficConfidence = "real" | "likely_internal" | "internal" | "bot";

export interface TrafficClassification {
  isInternal: boolean;
  confidence: TrafficConfidence;
  reason: string;
}

const BOT_UA =
  /bot|crawler|spider|crawling|headless|preview|lighthouse|pagespeed|gtmetrix|chrome-lighthouse/i;

const INTERNAL_HOSTS = [
  "localhost",
  "127.0.0.1",
  "id-preview--",
  "lovable.app",
  "lovable.dev",
  "lovableproject.com",
];

const INTERNAL_EMAIL_DOMAINS = ["@lovable.dev", "@garageflow.pt"];

export function classifyTraffic(opts?: {
  email?: string | null;
  isSuperAdmin?: boolean;
}): TrafficClassification {
  if (typeof window === "undefined") {
    return { isInternal: true, confidence: "internal", reason: "ssr" };
  }

  const ua = navigator.userAgent || "";
  const host = window.location.hostname || "";
  const params = new URLSearchParams(window.location.search);

  if (BOT_UA.test(ua)) {
    return { isInternal: true, confidence: "bot", reason: "bot_user_agent" };
  }

  if (params.get("internal") === "true") {
    return { isInternal: true, confidence: "internal", reason: "internal_param" };
  }

  if (document.cookie.includes("gf_internal=1")) {
    return { isInternal: true, confidence: "internal", reason: "internal_cookie" };
  }

  if (opts?.isSuperAdmin) {
    return { isInternal: true, confidence: "internal", reason: "super_admin" };
  }

  if (opts?.email) {
    const lower = opts.email.toLowerCase();
    if (INTERNAL_EMAIL_DOMAINS.some((d) => lower.endsWith(d))) {
      return { isInternal: true, confidence: "internal", reason: "internal_email" };
    }
  }

  for (const h of INTERNAL_HOSTS) {
    if (host === h || host.startsWith(h) || host.includes(h)) {
      // Preview/localhost: tratamos como provavelmente interno (não bloqueia mas marca)
      return {
        isInternal: true,
        confidence: "likely_internal",
        reason: `preview_host:${host}`,
      };
    }
  }

  // Heurística: se o referrer for o próprio preview ou lovable
  const ref = (document.referrer || "").toLowerCase();
  if (ref.includes("lovable.")) {
    return {
      isInternal: true,
      confidence: "likely_internal",
      reason: "lovable_referrer",
    };
  }

  return { isInternal: false, confidence: "real", reason: "" };
}

/** Marca este browser como tráfego interno (chamar no admin login se quiser). */
export function markBrowserAsInternal() {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `gf_internal=1; path=/; max-age=${oneYear}; SameSite=Lax`;
}
