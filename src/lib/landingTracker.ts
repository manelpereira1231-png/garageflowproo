import { supabase } from "@/integrations/supabase/client";

const TRACKED_KEY = "gf_visit_tracked";

/**
 * Regista uma visita à landing page com dados de origem (UTM, gclid, etc.)
 * Só regista uma vez por sessão.
 */
export function trackLandingVisit() {
  try {
    if (sessionStorage.getItem(TRACKED_KEY)) return;
    sessionStorage.setItem(TRACKED_KEY, "1");

    const params = new URLSearchParams(window.location.search);
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    const visit = {
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      gclid: params.get("gclid") || "",
      landing_path: window.location.pathname,
      referrer: document.referrer || "",
      device_type: isMobile ? "mobile" : "desktop",
      session_id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    };

    // Fire-and-forget — never block UI
    supabase.from("landing_visits").insert(visit).then(() => {});
  } catch {
    // Silent — tracking should never break UX
  }
}
