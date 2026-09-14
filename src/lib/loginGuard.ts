/**
 * Client helpers for the `login-guard` edge function.
 *
 * Rate-limits FAILED logins only: 8 wrong passwords per email (or 20 per IP)
 * within 15 minutes. A correct password always goes through and clears the
 * counter. Fails OPEN on any infra problem — a guard outage must never lock
 * a workshop out of its own ERP.
 */
import { supabase } from "@/integrations/supabase/client";

export async function ensureLoginAllowed(email: string, realm: "erp" | "market" | "affiliate"): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("login-guard", {
      body: { email, realm, action: "check" },
    });
    if (error || !data) return; // fail open
    if (data.allowed === false) {
      const minutes = data.retry_after_minutes ?? 15;
      throw new Error(
        `Demasiadas tentativas de início de sessão falhadas. Tente novamente daqui a ${minutes} minutos ou recupere a palavra-passe.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Demasiadas tentativas")) throw e;
    // swallow infra errors
  }
}

export function recordLoginFailure(email: string, realm: "erp" | "market" | "affiliate"): void {
  void supabase.functions.invoke("login-guard", { body: { email, realm, action: "fail" } }).catch(() => {});
}

export function clearLoginFailures(email: string): void {
  void supabase.functions.invoke("login-guard", { body: { email, action: "reset" } }).catch(() => {});
}
