import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Missing Authorization");
    const token = auth.replace("Bearer ", "");
    const { data: u } = await supa.auth.getUser(token);
    const user = u?.user;
    if (!user) throw new Error("Unauthorized");

    const { data: sup } = await supa
      .from("gsn_suppliers")
      .select("id, stripe_account_id, email, country")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!sup) throw new Error("Fornecedor não encontrado");

    let accountId = sup.stripe_account_id;
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: "express",
        country: (sup.country || "PT").toUpperCase(),
        email: sup.email || user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "company",
        metadata: { gsn_supplier_id: sup.id },
      });
      accountId = acct.id;
      await supa.from("gsn_suppliers").update({ stripe_account_id: accountId }).eq("id", sup.id);
    }

    const origin = req.headers.get("origin") || "https://garageflow.pt";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/supplier/profile?stripe=refresh`,
      return_url: `${origin}/supplier/profile?stripe=return`,
      type: "account_onboarding",
    });

    // Sync capability flags
    const acct = await stripe.accounts.retrieve(accountId);
    await supa.from("gsn_suppliers").update({
      stripe_charges_enabled: acct.charges_enabled,
      stripe_payouts_enabled: acct.payouts_enabled,
    }).eq("id", sup.id);

    return new Response(JSON.stringify({ url: link.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
