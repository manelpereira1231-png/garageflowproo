/**
 * gsn-connect-status
 * ------------------
 * Estado REAL da conta Stripe Connect do fornecedor autenticado.
 * Nunca devolve estado inventado: se não existir conta, devolve connected=false.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: u } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = u?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: sup } = await supa
      .from("gsn_suppliers")
      .select("id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!sup) return json({ error: "Fornecedor não encontrado" }, 404);

    if (!sup.stripe_account_id) {
      return json({ connected: false, charges_enabled: false, payouts_enabled: false, requirements: [] });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      // Sem chave configurada não há estado real disponível.
      return json({
        connected: true,
        account_id: sup.stripe_account_id,
        charges_enabled: !!sup.stripe_charges_enabled,
        payouts_enabled: !!sup.stripe_payouts_enabled,
        live: false,
        note: "Estado em cache (Stripe indisponível)",
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const acct = await stripe.accounts.retrieve(sup.stripe_account_id);

    await supa
      .from("gsn_suppliers")
      .update({
        stripe_charges_enabled: acct.charges_enabled,
        stripe_payouts_enabled: acct.payouts_enabled,
      })
      .eq("id", sup.id);

    return json({
      connected: true,
      live: true,
      account_id: acct.id,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      details_submitted: acct.details_submitted,
      requirements: acct.requirements?.currently_due ?? [],
      disabled_reason: acct.requirements?.disabled_reason ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
