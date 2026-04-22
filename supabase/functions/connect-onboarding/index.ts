import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Creates a Stripe Connect Express account (or reuses existing) and returns
 * an onboarding link. Supports two roles:
 *   - "seller"  → updates carity_seller_profiles
 *   - "shop"    → updates shops (requires shop_id)
 *
 * Body: { role: "seller" | "shop", shop_id?: string, return_path?: string }
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
    if (!user?.email) throw new Error("Não autenticado");

    const body = await req.json().catch(() => ({}));
    const role: "seller" | "shop" = body.role === "shop" ? "shop" : "seller";
    const shopId: string | undefined = body.shop_id;
    const returnPath: string = body.return_path || "/market/seller";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let accountId: string | null = null;
    let countryCode = "PT";

    if (role === "seller") {
      const { data: profile } = await supabaseAdmin
        .from("carity_seller_profiles")
        .select("id, stripe_connect_account_id, country_code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new Error("Perfil de vendedor não encontrado. Conclua o KYC primeiro.");
      accountId = profile.stripe_connect_account_id;
      countryCode = (profile.country_code || "PT").toUpperCase();
    } else {
      if (!shopId) throw new Error("shop_id é obrigatório para oficinas");
      // Verify user belongs to shop (via RLS by querying as user)
      const { data: shop } = await supabaseClient
        .from("shops")
        .select("id, stripe_connect_account_id, country")
        .eq("id", shopId)
        .maybeSingle();
      if (!shop) throw new Error("Oficina não encontrada ou sem permissão");
      accountId = shop.stripe_connect_account_id;
      countryCode = (shop.country || "PT").toUpperCase();
    }

    // Create Express account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: countryCode,
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: role === "shop" ? "company" : "individual",
        metadata: { user_id: user.id, role, shop_id: shopId || "" },
      });
      accountId = account.id;

      const updatePayload = {
        stripe_connect_account_id: accountId,
        stripe_connect_onboarded: false,
        stripe_connect_charges_enabled: false,
        stripe_connect_payouts_enabled: false,
      };
      if (role === "seller") {
        await supabaseAdmin
          .from("carity_seller_profiles")
          .update(updatePayload)
          .eq("user_id", user.id);
      } else {
        await supabaseAdmin.from("shops").update(updatePayload).eq("id", shopId);
      }
    }

    const origin = req.headers.get("origin") || "https://garageflow.pt";
    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${origin}${returnPath}?connect=refresh`,
      return_url: `${origin}${returnPath}?connect=done`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[connect-onboarding] error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
