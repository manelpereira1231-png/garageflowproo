import { supabase } from "@/integrations/supabase/client";
import { classifyTraffic } from "./internalTrafficDetect";

const TRACKED_KEY = "gf_visit_tracked"; // legacy (session-wide) — kept for compat
const TRACKED_PATHS_KEY = "gf_visit_tracked_paths"; // per-path dedup within the session
const FIRST_TOUCH_KEY = "gf_first_touch";
const SESSION_ID_KEY = "gf_session_id";
const MAX_RETRIES = 3;

interface VisitPayload {
  source: string;
  medium: string;
  campaign: string;
  gclid: string;
  landing_path: string;
  referrer: string;
  device_type: string;
  session_id: string;
  country_hint: string;
  is_internal: boolean;
  internal_reason: string;
  confidence: string;
  first_touch_source: string;
  user_agent: string;
  hostname: string;
}

function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  }
}

function getOrSetFirstTouch(source: string): string {
  try {
    const existing = localStorage.getItem(FIRST_TOUCH_KEY);
    if (existing) return existing;
    if (source) {
      localStorage.setItem(FIRST_TOUCH_KEY, source);
      return source;
    }
  } catch {
    /* ignore */
  }
  return source;
}

/**
 * Regista uma visita à landing page com dados de origem (UTM, gclid, etc.)
 * - Uma visita por sessão do browser (tab/janela)
 * - Marca tráfego interno (admin, dev, preview, bot)
 * - Guarda first_touch persistente
 * - Atualiza scroll_depth e time_on_page no beforeunload
 */
export function trackLandingVisit() {
  try {
    if (sessionStorage.getItem(TRACKED_KEY)) {
      setupEngagementTracking();
      return;
    }
    sessionStorage.setItem(TRACKED_KEY, "1");

    const params = new URLSearchParams(window.location.search);
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const classification = classifyTraffic();

    const source = params.get("utm_source") || inferSource(document.referrer);
    const firstTouch = getOrSetFirstTouch(source);
    const sessionId = getOrCreateSessionId();

    const visit: VisitPayload = {
      source,
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      gclid: params.get("gclid") || "",
      landing_path: window.location.pathname,
      referrer: document.referrer || "",
      device_type: isMobile ? "mobile" : "desktop",
      session_id: sessionId,
      country_hint: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      is_internal: classification.isInternal,
      internal_reason: classification.reason,
      confidence: classification.confidence,
      first_touch_source: firstTouch,
      user_agent: (navigator.userAgent || "").slice(0, 500),
      hostname: window.location.hostname,
    };

    insertWithRetry(visit, 0);
    setupEngagementTracking();
  } catch {
    /* nunca bloquear a UX */
  }
}

function inferSource(referrer: string): string {
  if (!referrer) return "";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes("google.")) return "google";
    if (host.includes("bing.")) return "bing";
    if (host.includes("duckduckgo.")) return "duckduckgo";
    if (host.includes("facebook.") || host.includes("fb.")) return "facebook";
    if (host.includes("instagram.")) return "instagram";
    if (host.includes("linkedin.")) return "linkedin";
    if (host.includes("youtube.")) return "youtube";
    return host;
  } catch {
    return "";
  }
}

async function insertWithRetry(visit: VisitPayload, attempt: number) {
  try {
    const { error } = await supabase.from("landing_visits").insert(visit);
    if (error && attempt < MAX_RETRIES) {
      setTimeout(() => insertWithRetry(visit, attempt + 1), 1000 * (attempt + 1));
    } else if (error) {
      sessionStorage.removeItem(TRACKED_KEY);
    }
  } catch {
    if (attempt < MAX_RETRIES) {
      setTimeout(() => insertWithRetry(visit, attempt + 1), 1000 * (attempt + 1));
    } else {
      sessionStorage.removeItem(TRACKED_KEY);
    }
  }
}

let engagementSetup = false;
function setupEngagementTracking() {
  if (engagementSetup) return;
  engagementSetup = true;

  const startedAt = Date.now();
  let maxScroll = 0;

  const onScroll = () => {
    const h = document.documentElement;
    const total = (h.scrollHeight - h.clientHeight) || 1;
    const pct = Math.min(100, Math.round((h.scrollTop / total) * 100));
    if (pct > maxScroll) maxScroll = pct;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const send = () => {
    try {
      const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
      if (!sessionId) return;
      const time = Math.round((Date.now() - startedAt) / 1000);
      // Fire-and-forget via RPC (security definer)
      void supabase.rpc("update_landing_visit_engagement", {
        _session_id: sessionId,
        _scroll: maxScroll,
        _time: time,
      });
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("pagehide", send);
  window.addEventListener("beforeunload", send);
}

/** Regista uma conversão SEO (signup/registo) ligada à sessão atual. */
export async function trackSeoConversion(opts: {
  userId?: string;
  shopId?: string;
  type?: "signup" | "trial" | "paid";
}) {
  try {
    const sessionId = sessionStorage.getItem(SESSION_ID_KEY) || "";
    const firstTouch = (typeof localStorage !== "undefined" && localStorage.getItem(FIRST_TOUCH_KEY)) || "";
    const params = new URLSearchParams(window.location.search);
    const lastTouch = params.get("utm_source") || inferSource(document.referrer) || "direct";
    await supabase.from("seo_conversions").insert({
      session_id: sessionId,
      user_id: opts.userId,
      shop_id: opts.shopId,
      landing_path: window.location.pathname,
      first_touch_source: firstTouch,
      last_touch_source: lastTouch,
      utm_campaign: params.get("utm_campaign") || "",
      conversion_type: opts.type || "signup",
    });
  } catch {
    /* never throw */
  }
}
