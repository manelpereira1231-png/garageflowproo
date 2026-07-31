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
    if (!authHeader) throw new Error("Sessão expirada. Volte a iniciar sessão.");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user?.email) throw new Error("Sessão expirada. Volte a iniciar sessão.");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Pagamentos ainda não estão configurados na plataforma. Contacte o suporte.");
    }

    const body = await req.json().catch(() => ({}));
    const role: "seller" | "shop" = body.role === "shop" ? "shop" : "seller";
    const shopId: string | undefined = body.shop_id;
    const returnPath: string = body.return_path || "/market/seller";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let accountId: string | null = null;
    let countryCode = "PT";

    if (role === "seller") {
      let { data: profile } = await supabaseAdmin
        .from("carity_seller_profiles")
        .select("id, stripe_connect_account_id, country_code")
        .eq("user_id", user.id)
        .maybeSingle();

      // Auto-create a minimal seller profile so onboarding never blocks with "perfil não encontrado".
      // The user can still complete KYC afterwards.
      if (!profile) {
        const { data: created, error: createErr } = await supabaseAdmin
          .from("carity_seller_profiles")
          .insert({ user_id: user.id, country_code: "PT" })
          .select("id, stripe_connect_account_id, country_code")
          .maybeSingle();
        if (createErr) {
          console.error("[connect-onboarding] auto-create profile error", createErr);
          throw new Error("Não foi possível criar o perfil de vendedor. Tente novamente ou contacte o suporte.");
        }
        profile = created;
      }
      accountId = profile?.stripe_connect_account_id ?? null;
      countryCode = (profile?.country_code || "PT").toUpperCase();
    } else {
      if (!shopId) throw new Error("shop_id é obrigatório para oficinas");
      // Usa o admin client + verificação explícita de propriedade: o anon client
      // não recebia o JWT do utilizador, pelo que a RLS bloqueava sempre a leitura.
      const { data: shop } = await supabaseAdmin
        .from("shops")
        .select("id, stripe_connect_account_id, country, user_id, group_owner_id")
        .eq("id", shopId)
        .maybeSingle();
      if (!shop) throw new Error("Oficina não encontrada");
      if (shop.user_id !== user.id && shop.group_owner_id !== user.id) {
        throw new Error("Sem permissão para configurar pagamentos desta oficina");
      }
      accountId = shop.stripe_connect_account_id;
      countryCode = (shop.country || "PT").toUpperCase();
    }

    // Country codes must be ISO-2 uppercase (Stripe reject invalid values with 400)
    if (!/^[A-Z]{2}$/.test(countryCode)) countryCode = "PT";

    if (!accountId) {
      try {
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
      } catch (stripeErr: any) {
        console.error("[connect-onboarding] stripe.accounts.create failed", stripeErr);
        const msg = stripeErr?.raw?.message || stripeErr?.message || "Erro Stripe";
        throw new Error(`Stripe rejeitou a criação da conta (${countryCode}): ${msg}`);
      }

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
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// redeploy trigger 1785511365
