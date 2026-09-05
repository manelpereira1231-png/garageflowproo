/**
 * SALES DEMO — camada mínima de suporte a /demo-demonstracao.
 *
 * Pede uma sessão temporária e isolada ao edge function
 * `sales-demo`, marca a sessão como "modo demonstração" e permite trocar
 * o contexto de plano (Start / Pro / Garage) APENAS na oficina demo.
 */
import { supabase } from "@/integrations/supabase/client";
import { resetActiveShopOnLogout } from "@/lib/shopContextSync";
import { trackDemoEnter, trackDemoEvent } from "@/lib/demoTracker";
import { clearPartnerAttribution } from "@/lib/partnerAttribution";

export type DemoPlan = "free" | "pro" | "garage";

export const DEMO_FLAG = "gf_sales_demo";
export const DEMO_PLAN_KEY = "gf_sales_demo_plan";
export const DEMO_BAR_HIDDEN = "gf_sales_demo_bar_hidden";
export const DEMO_MODE_KEY = "gf_sales_demo_mode";
const ACTIVE_SHOP_KEY = "garageflow_active_shop";

export const PLAN_LABEL: Record<DemoPlan, string> = {
  free: "Start",
  pro: "Pro",
  garage: "Garage",
};

export function isDemoSession(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function currentDemoPlan(): DemoPlan {
  try {
    const p = localStorage.getItem(DEMO_PLAN_KEY);
    return p === "free" || p === "pro" || p === "garage" ? p : "pro";
  } catch {
    return "pro";
  }
}

async function callDemo(action: "start" | "plan" | "reset" | "end", plan: DemoPlan) {
  const { data, error } = await supabase.functions.invoke("sales-demo", { body: { action, plan } });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { shop_id: string; plan: DemoPlan; session?: { access_token: string; refresh_token: string } };
}

/** Inicia a demonstração: sessão em background + contexto de plano. */
export async function startDemo(plan: DemoPlan, mode: "self" | "sales" = "self") {
  const res = await callDemo("start", plan);
  if (!res.session) throw new Error("Sessão de demonstração indisponível");
  const { error } = await supabase.auth.setSession(res.session);
  if (error) throw new Error(error.message);
  localStorage.setItem(ACTIVE_SHOP_KEY, res.shop_id);
  // Demonstração: ERP completo em português, sem ecrãs de onboarding.
  localStorage.setItem("garageflow_app_mode", "pro");
  localStorage.setItem("garageflow_onboarding_status", "completed");
  localStorage.setItem("garageflow_onboarding_completed", "true");
  localStorage.setItem("gf_auto_onboarding_dismissed", "1");
  localStorage.setItem("garageflow_language", "pt");
  localStorage.setItem(DEMO_FLAG, "1");
  localStorage.setItem(DEMO_PLAN_KEY, plan);
  localStorage.setItem(DEMO_MODE_KEY, mode);
  trackDemoEnter();
  return res.shop_id;
}

/** Muda apenas o contexto de plano da oficina demo. */
export async function switchDemoPlan(plan: DemoPlan) {
  await callDemo("plan", plan);
  localStorage.setItem(DEMO_PLAN_KEY, plan);
  trackDemoEvent("plan_switch", { label: plan });
}

/** Repõe os dados fictícios da oficina demo para a próxima apresentação. */
export async function resetDemo(plan: DemoPlan = currentDemoPlan()) {
  await callDemo("reset", plan);
}

/** Limpeza local — síncrona e infalível. Só corre em sessões demo. */
function wipeDemoLocalState() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("gf_sales_demo") || k.startsWith("gf_demo"))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    [
      DEMO_FLAG, DEMO_PLAN_KEY, DEMO_BAR_HIDDEN, DEMO_MODE_KEY, ACTIVE_SHOP_KEY,
      "garageflow_app_mode", "garageflow_onboarding_status",
      "garageflow_onboarding_completed", "gf_auto_onboarding_dismissed",
    ].forEach((k) => localStorage.removeItem(k));
  } catch { /* storage pode estar desativado */ }
  try {
    const sKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith("gf_sales_demo") || k.startsWith("gf_demo"))) sKeys.push(k);
    }
    sKeys.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* noop */ }
}

const withTimeout = (p: Promise<unknown>, ms = 4000) =>
  Promise.race([p.catch(() => undefined), new Promise((r) => setTimeout(r, ms))]);

/** Termina o modo demonstração e limpa a sessão. */
export async function endDemo() {
  const wasDemo = isDemoSession();
  const plan = currentDemoPlan();
  if (wasDemo) trackDemoEvent("demo_end");
  wipeDemoLocalState();
  if (wasDemo) {
    // Melhor esforço: o TTL do tenant demo garante a limpeza mesmo se falhar.
    await withTimeout(callDemo("end", plan));
  }
  await resetActiveShopOnLogout();
  await withTimeout(supabase.auth.signOut());
}

/**
 * CTA final da Demo: termina o contexto demo por completo e leva o visitante
 * ao registo real. Usa navegação "hard" para garantir que nenhum estado em
 * memória (contexto de oficina, caches de query) sobrevive à transição.
 */
export async function exitDemoToSignup() {
  if (isDemoSession()) trackDemoEvent("cta_signup");
  // Pequena margem para o evento sair antes da navegação hard.
  await withTimeout(new Promise((r) => setTimeout(r, 300)), 500);
  try { await endDemo(); } catch { /* estado local já foi limpo */ }
  wipeDemoLocalState();
  window.location.replace("/auth?mode=signup");
}


