import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Diagnostic-only endpoint: verifies that STRIPE_SECRET_KEY can perform the two
 * Stripe Connect operations used by onboarding (accounts.create + accountLinks.create).
 * The test account is deleted immediately afterwards. No secret value is ever returned.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const steps: Record<string, unknown> = {};
  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!key) throw new Error("STRIPE_SECRET_KEY não está definida");

    // Only the key TYPE is reported (never the value)
    steps.key_type = key.startsWith("sk_live_")
      ? "secret_live"
      : key.startsWith("sk_test_")
      ? "secret_test"
      : key.startsWith("rk_live_")
      ? "restricted_live"
      : key.startsWith("rk_test_")
      ? "restricted_test"
      : "unknown";

    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });

    const acct = await stripe.accounts.create({
      type: "express",
      country: "PT",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { selftest: "true" },
    });
    steps.accounts_create = "ok";

    const link = await stripe.accountLinks.create({
      account: acct.id,
      refresh_url: "https://garageflow.pt/admin/payment-fees?connect=refresh",
      return_url: "https://garageflow.pt/admin/payment-fees?connect=done",
      type: "account_onboarding",
    });
    steps.account_links_create = "ok";
    steps.onboarding_url_host = new URL(link.url).host;

    try {
      await stripe.accounts.del(acct.id);
      steps.cleanup = "deleted";
    } catch {
      steps.cleanup = "manual_cleanup_needed:" + acct.id;
    }

    return new Response(JSON.stringify({ ok: true, steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const err = e as { type?: string; code?: string; message?: string };
    return new Response(
      JSON.stringify({
        ok: false,
        steps,
        error_type: err?.type || "unknown",
        error_code: err?.code || null,
        message: err?.message || String(e),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
