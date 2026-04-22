import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Refreshes Connect account status (charges_enabled, payouts_enabled, details_submitted)
 * and writes it back to carity_seller_profiles or shops.
 *
 * Body: { role: "seller" | "shop", shop_id?: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Não autenticado");

    const body = await req.json().catch(() => ({}));
    const role: "seller" | "shop" = body.role === "shop" ? "shop" : "seller";
    const shopId: string | undefined = body.shop_id;

    let accountId: string | null = null;
    if (role === "seller") {
      const { data: profile } = await supabaseAdmin
        .from("carity_seller_profiles")
        .select("stripe_connect_account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      accountId = profile?.stripe_connect_account_id || null;
    } else {
      if (!shopId) throw new Error("shop_id é obrigatório");
      const { data: shop } = await supabaseClient
        .from("shops")
        .select("stripe_connect_account_id")
        .eq("id", shopId)
        .maybeSingle();
      accountId = shop?.stripe_connect_account_id || null;
    }

    if (!accountId) {
      return new Response(
        JSON.stringify({ onboarded: false, charges_enabled: false, payouts_enabled: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const account = await stripe.accounts.retrieve(accountId);

    const onboarded = !!account.details_submitted;
    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;

    const updatePayload = {
      stripe_connect_onboarded: onboarded,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
    };
    if (role === "seller") {
      await supabaseAdmin
        .from("carity_seller_profiles")
        .update(updatePayload)
        .eq("user_id", user.id);
    } else {
      await supabaseAdmin.from("shops").update(updatePayload).eq("id", shopId);
    }

    return new Response(
      JSON.stringify({
        onboarded,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        requirements: account.requirements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[connect-status] error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
