/**
 * Calls the signup-guard edge function to check IP+email rate limits BEFORE
 * supabase.auth.signUp. Throws a user-friendly Error if blocked.
 *
 * Limits enforced server-side: 5 signups/hour/IP, 3 signups/24h/email.
 * Fails OPEN if the guard itself errors (better UX than blocking onboarding).
 */
import { supabase } from "@/integrations/supabase/client";

export async function ensureSignupAllowed(email: string, realm: "erp" | "market"): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("signup-guard", {
      body: { email, realm },
    });
    // Network/infra failure → fail open
    if (error || !data) return;

    if (data.allowed === false) {
      const minutes = data.retry_after_minutes ?? 60;
      const reason = data.reason as string | undefined;
      if (reason === "too_many_for_email") {
        throw new Error("Demasiadas tentativas para este email. Tente novamente daqui a 24h ou recupere a palavra-passe.");
      }
      if (reason === "too_many_from_ip") {
        throw new Error(`Demasiadas tentativas de registo deste dispositivo. Tente novamente daqui a ${minutes} min.`);
      }
      if (reason === "invalid_email") {
        throw new Error("Email inválido.");
      }
      throw new Error("Não foi possível processar o registo agora. Tente mais tarde.");
    }
  } catch (e) {
    // Re-throw user-facing errors; swallow infra ones (fail open).
    if (e instanceof Error && e.message && !e.message.includes("Failed to fetch")) {
      throw e;
    }
  }
}
