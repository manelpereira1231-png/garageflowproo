/**
 * SALES DEMO — camada mínima de suporte a /demo-demonstracao.
 *
 * Pede uma sessão temporária e isolada ao edge function
 * `sales-demo`, marca a sessão como "modo demonstração" e permite trocar
 * o contexto de plano (Start / Pro / Garage) APENAS na oficina demo.
 */
import { supabase } from "@/integrations/supabase/client";

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
  return res.shop_id;
}

/** Muda apenas o contexto de plano da oficina demo. */
export async function switchDemoPlan(plan: DemoPlan) {
  await callDemo("plan", plan);
  localStorage.setItem(DEMO_PLAN_KEY, plan);
}

/** Repõe os dados fictícios da oficina demo para a próxima apresentação. */
export async function resetDemo(plan: DemoPlan = currentDemoPlan()) {
  await callDemo("reset", plan);
}

/** Termina o modo demonstração e limpa a sessão. */
export async function endDemo() {
  if (isDemoSession()) {
    try { await callDemo("end", currentDemoPlan()); } catch { /* expiry cleanup remains as fallback */ }
  }
  try {
    localStorage.removeItem(DEMO_FLAG);
    localStorage.removeItem(DEMO_PLAN_KEY);
    localStorage.removeItem(DEMO_BAR_HIDDEN);
    localStorage.removeItem(DEMO_MODE_KEY);
    localStorage.removeItem(ACTIVE_SHOP_KEY);
    localStorage.removeItem("garageflow_app_mode");
    localStorage.removeItem("garageflow_onboarding_status");
    localStorage.removeItem("garageflow_onboarding_completed");
    localStorage.removeItem("gf_auto_onboarding_dismissed");
  } catch { /* storage pode estar desativado */ }
  await supabase.auth.signOut();
}
