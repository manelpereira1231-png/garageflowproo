import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fallback EUR price IDs (Portugal) used if a country has no specific Stripe IDs configured
const FALLBACK_EUR = {
  pro_monthly: "price_1T4YARE1zL2Sl1ZT0iAS9Cmk",
  pro_yearly: "price_1T49EZE1zL2Sl1ZTHGB40FiB",
  garage_monthly: "price_1T4YAeE1zL2Sl1ZTrqc35wZy",
  garage_yearly: "price_1T49EnE1zL2Sl1ZTs0crtbLM",
};

// Map legacy region codes to country codes
const REGION_TO_COUNTRY: Record<string, string> = {
  eu: "PT", br: "BR", pt: "PT", in: "IN", us: "US",
  uk: "UK", gb: "UK", de: "DE", es: "ES", fr: "FR",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function publicErrorMessage(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("No such price")) return "Stripe Price não encontrado na conta configurada.";
  if (msg.includes("No such customer")) return "Cliente Stripe inválido. Tente novamente.";
  if (msg.includes("No Stripe price configured")) return msg;
  if (msg.includes("Not authenticated") || msg.includes("authorization")) return msg;
  return msg || "Erro ao criar checkout";
}

// ─── Local payment methods per country (subscription mode = recurring-compatible only) ───
const SUBSCRIPTION_METHODS: Record<string, string[]> = {
  PT: ["card", "sepa_debit", "link"],
  ES: ["card", "sepa_debit", "link"], FR: ["card", "sepa_debit", "link"],
  DE: ["card", "sepa_debit", "link"], IT: ["card", "sepa_debit", "link"],
  NL: ["card", "sepa_debit", "link"], BE: ["card", "sepa_debit", "link"],
  AT: ["card", "sepa_debit", "link"], IE: ["card", "sepa_debit", "link"],
  FI: ["card", "sepa_debit", "link"], GR: ["card", "sepa_debit", "link"],
  LU: ["card", "sepa_debit", "link"],
  UK: ["card", "bacs_debit", "link"], GB: ["card", "bacs_debit", "link"],
  US: ["card", "us_bank_account", "link"],
  CA: ["card", "acss_debit", "link"],
  AU: ["card", "au_becs_debit", "link"],
  BR: ["card"], IN: ["card", "link"], MX: ["card", "link"],
};
function getSubscriptionMethods(country: string): string[] {
  return SUBSCRIPTION_METHODS[country.toUpperCase()] || ["card", "link"];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");

    const user = userData.user;
    const { plan, billing_cycle, region, country_code } = await req.json();

    if (!plan || !["pro", "garage"].includes(plan)) {
      throw new Error("O plano gratuito não requer checkout Stripe. Escolha Pro ou Garage para subscrever.");
    }
    const cycle = (billing_cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";

    // Resolve country: explicit country_code > legacy region > shop country > PT fallback
    let resolvedCountry = (country_code || REGION_TO_COUNTRY[String(region || "").toLowerCase()] || "").toUpperCase();

    // Try to load shop info (for NIF/phone anti-fraud + country fallback)
    const { data: shopData } = await supabaseClient
      .from("shops")
      .select("id, nif, phone, country_code")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!resolvedCountry && shopData?.country_code) {
      resolvedCountry = String(shopData.country_code).toUpperCase();
    }
    if (!resolvedCountry) resolvedCountry = "PT";

    // Load country settings (Stripe price IDs + trial days)
    const { data: countryConfig } = await supabaseClient
      .from("country_settings")
      .select("stripe_free_monthly,stripe_free_yearly,stripe_pro_monthly,stripe_pro_yearly,stripe_garage_monthly,stripe_garage_yearly,saas_trial_days,currency")
      .eq("code", resolvedCountry)
      .eq("active", true)
      .maybeSingle();

    if (!countryConfig) {
      console.warn("[create-checkout] country settings missing or inactive", { resolvedCountry, plan, cycle });
    }

    // Determine price ID — fallback to EUR if not set for this country
    const priceMap: Record<string, string | null | undefined> = {
      pro_monthly: countryConfig?.stripe_pro_monthly,
      pro_yearly: countryConfig?.stripe_pro_yearly,
      garage_monthly: countryConfig?.stripe_garage_monthly,
      garage_yearly: countryConfig?.stripe_garage_yearly,
    };
    const key = `${plan}_${cycle}`;
    const priceId = priceMap[key] || (FALLBACK_EUR as any)[key];
    if (!priceId) throw new Error(`No Stripe price configured for ${plan}/${cycle} in ${resolvedCountry}`);

    const trialDays = countryConfig?.saas_trial_days ?? 30;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active) {
        throw new Error(`Stripe Price inactive: ${priceId}`);
      }
      if (price.type !== "recurring" || !price.recurring) {
        throw new Error(`Stripe Price is not recurring: ${priceId}`);
      }
      const expectedInterval = cycle === "yearly" ? "year" : "month";
      if (price.recurring.interval !== expectedInterval) {
        throw new Error(`Stripe Price interval mismatch for ${plan}/${cycle}: ${priceId}`);
      }
    } catch (priceError) {
      console.error("[create-checkout] invalid price", {
        country: resolvedCountry,
        plan,
        cycle,
        priceId,
        message: priceError instanceof Error ? priceError.message : String(priceError),
      });
      throw priceError;
    }

    // Validate email — if invalid (test/legacy accounts), let Stripe collect a valid one at checkout
    const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmail = EMAIL_RX.test(user.email || "");

    // Find or create customer
    let customerId: string | undefined;
    if (validEmail) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    // --- ANTI-FRAUD TRIAL CHECK ---
    const userNif = shopData?.nif || null;
    const userPhone = shopData?.phone || null;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const { data: eligible, error: eligibilityError } = await supabaseClient.rpc("check_trial_eligibility", {
      _email: user.email,
      _nif: userNif,
      _phone: userPhone,
      _stripe_customer_id: customerId || null,
    });
    if (eligibilityError) {
      console.warn("[create-checkout] trial eligibility check failed; continuing without trial", eligibilityError.message);
    }

    let stripeHadTrial = false;
    if (customerId) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 100,
        status: "all",
      });
      stripeHadTrial = subs.data.some(
        (s) => s.trial_start !== null || s.status === "trialing"
      );
    }

    const canTrial = !eligibilityError && eligible === true && !stripeHadTrial && trialDays > 0;

    // Always use the custom domain
    const rawOrigin = req.headers.get("origin") || "";
    const origin = rawOrigin.includes("lovable.app") || rawOrigin.includes("lovableproject.com") || !rawOrigin
      ? "https://www.garageflow.pt"
      : rawOrigin;

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId || !validEmail ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      // Let Stripe auto-select activated payment methods from dashboard (avoids errors when a method isn't enabled)
      automatic_tax: { enabled: false },
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
    };

    if (canTrial) {
      sessionParams.subscription_data = { trial_period_days: trialDays };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (canTrial && shopData) {
      const { error: trialInsertError } = await supabaseClient.from("trial_records").insert({
        user_id: user.id,
        shop_id: shopData.id,
        email: user.email,
        nif: userNif,
        phone: userPhone,
        stripe_customer_id: customerId || null,
        ip_address: clientIp,
        trial_start: new Date().toISOString(),
        trial_end: new Date(Date.now() + trialDays * 86400000).toISOString(),
      });
      if (trialInsertError) {
        console.warn("[create-checkout] trial record insert failed", trialInsertError.message);
      }
    }

    return jsonResponse({
      url: session.url,
      trial_granted: canTrial,
      country: resolvedCountry,
      currency: countryConfig?.currency || "EUR",
    });
  } catch (error) {
    const msg = publicErrorMessage(error);
    console.error("[create-checkout] error", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
