/**
 * SALES DEMO — camada mínima de suporte a /demo-demonstracao.
 *
 * Não altera Auth, Billing, Permissões nem qualquer funcionalidade do ERP.
 * Apenas: pede uma sessão da conta de demonstração ao edge function
 * `sales-demo`, marca a sessão como "modo demonstração" e permite trocar
 * o contexto de plano (Free / Pro / Garage) APENAS na oficina demo.
 */
import { supabase } from "@/integrations/supabase/client";

export type DemoPlan = "free" | "pro" | "garage";

export const DEMO_FLAG = "gf_sales_demo";
export const DEMO_PLAN_KEY = "gf_sales_demo_plan";
export const DEMO_BAR_HIDDEN = "gf_sales_demo_bar_hidden";
const ACTIVE_SHOP_KEY = "garageflow_active_shop";

export const PLAN_LABEL: Record<DemoPlan, string> = {
  free: "Free",
  pro: "Pro",
  garage: "Garage",
};

export function isDemoSession(): boolean {
  try {
    return sessionStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function currentDemoPlan(): DemoPlan {
  try {
    const p = sessionStorage.getItem(DEMO_PLAN_KEY);
    return p === "free" || p === "pro" || p === "garage" ? p : "pro";
  } catch {
    return "pro";
  }
}

async function callDemo(action: "start" | "plan" | "reset", plan: DemoPlan) {
  const { data, error } = await supabase.functions.invoke("sales-demo", { body: { action, plan } });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { shop_id: string; plan: DemoPlan; session?: { access_token: string; refresh_token: string } };
}

/** Inicia a demonstração: sessão em background + contexto de plano. */
export async function startDemo(plan: DemoPlan) {
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
  sessionStorage.setItem(DEMO_FLAG, "1");
  sessionStorage.setItem(DEMO_PLAN_KEY, plan);
  return res.shop_id;
}

/** Muda apenas o contexto de plano da oficina demo. */
export async function switchDemoPlan(plan: DemoPlan) {
  await callDemo("plan", plan);
  sessionStorage.setItem(DEMO_PLAN_KEY, plan);
}

/** Repõe os dados fictícios da oficina demo para a próxima apresentação. */
export async function resetDemo(plan: DemoPlan = currentDemoPlan()) {
  await callDemo("reset", plan);
}

/** Termina o modo demonstração e limpa a sessão. */
export async function endDemo() {
  try {
    sessionStorage.removeItem(DEMO_FLAG);
    sessionStorage.removeItem(DEMO_PLAN_KEY);
    sessionStorage.removeItem(DEMO_BAR_HIDDEN);
  } catch { /* storage pode estar desativado */ }
  await supabase.auth.signOut();
}
