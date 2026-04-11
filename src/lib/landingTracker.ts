import { supabase } from "@/integrations/supabase/client";

const TRACKED_KEY = "gf_visit_tracked";
const MAX_RETRIES = 3;

/**
 * Regista uma visita à landing page com dados de origem (UTM, gclid, etc.)
 * - Uma visita por sessão do browser (tab/janela)
 * - Retry automático até 3x se falhar
 * - Nunca bloqueia a UI
 */
export function trackLandingVisit() {
  try {
    // Já registou nesta sessão? Sai.
    if (sessionStorage.getItem(TRACKED_KEY)) return;
    // Marca imediatamente para evitar duplicados em re-renders
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
      country_hint: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    };

    // Retry logic — se a BD falhar, tenta mais vezes
    insertWithRetry(visit, 0);
  } catch {
    // Silent — tracking nunca deve quebrar a UX
  }
}

async function insertWithRetry(visit: Record<string, string>, attempt: number) {
  try {
    const { error } = await supabase.from("landing_visits").insert(visit);
    if (error && attempt < MAX_RETRIES) {
      // Espera progressivamente mais tempo antes de tentar de novo
      setTimeout(() => insertWithRetry(visit, attempt + 1), 1000 * (attempt + 1));
    } else if (error) {
      // Falhou todas as tentativas — limpa flag para tentar novamente se user recarregar
      sessionStorage.removeItem(TRACKED_KEY);
      console.warn("[GarageFlow] Falha ao registar visita após 3 tentativas");
    }
  } catch {
    if (attempt < MAX_RETRIES) {
      setTimeout(() => insertWithRetry(visit, attempt + 1), 1000 * (attempt + 1));
    } else {
      sessionStorage.removeItem(TRACKED_KEY);
    }
  }
}
