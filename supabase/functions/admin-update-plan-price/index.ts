import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Plan = "free" | "pro" | "garage";
type Cycle = "monthly" | "yearly";

interface UpdateRequest {
  country_code: string;
  plan: Plan;
  cycle: Cycle;
  amount: number;       // in major units (e.g. 49 for €49)
  currency?: string;    // optional override; defaults to country currency
  notes?: string;
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ── Auth: must be super admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return badRequest("missing_authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return badRequest("not_authenticated");

    const { data: isAdmin } = await supabase.rpc("is_super_admin", {
      _user_id: userData.user.id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate body ──
    const body = (await req.json()) as Partial<UpdateRequest>;
    const country = String(body.country_code || "").toUpperCase().trim();
    const plan = body.plan;
    const cycle = body.cycle;
    const amount = Number(body.amount);

    if (!country) return badRequest("country_code_required");
    if (plan !== "free" && plan !== "pro" && plan !== "garage") return badRequest("plan_invalid");
    if (cycle !== "monthly" && cycle !== "yearly") return badRequest("cycle_invalid");
    if (!Number.isFinite(amount) || amount <= 0) return badRequest("amount_invalid");

    // ── Load country config ──
    const { data: countryRow, error: countryErr } = await supabase
      .from("country_settings")
      .select("*")
      .eq("code", country)
      .maybeSingle();
    if (countryErr) throw countryErr;
    if (!countryRow) return badRequest("country_not_found");

    const currency = (body.currency || countryRow.currency || "EUR").toLowerCase();

    const productCol = `stripe_${plan}_product_id`;
    const priceCol = `stripe_${plan}_${cycle}`;          // stripe_pro_monthly, etc.
    const amountCol = `saas_${plan}_${cycle}`;           // saas_pro_monthly, etc.

    const oldPriceId: string | null = (countryRow as any)[priceCol] ?? null;
    const oldAmount: number | null = (countryRow as any)[amountCol] ?? null;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ── Ensure Stripe Product exists for this country/plan ──
    let productId: string | null = (countryRow as any)[productCol] ?? null;
    if (!productId) {
      const product = await stripe.products.create({
        name: `GarageFlow ${plan === "pro" ? "Pro" : plan === "garage" ? "Garage" : "Entrada"} — ${country}`,
        metadata: { country, plan, source: "admin-update-plan-price" },
      });
      productId = product.id;
    }

    // ── Create the NEW Price (never edit the old one — legacy customers keep it) ──
    const unitAmount = Math.round(amount * 100); // Stripe wants minor units
    const newPrice = await stripe.prices.create({
      product: productId,
      currency,
      unit_amount: unitAmount,
      recurring: { interval: cycle === "yearly" ? "year" : "month" },
      metadata: { country, plan, cycle, source: "admin-update-plan-price" },
    });

    // ── Deactivate previous price (keeps existing subscriptions intact) ──
    if (oldPriceId && oldPriceId !== newPrice.id) {
      try {
        await stripe.prices.update(oldPriceId, { active: false });
      } catch (e) {
        console.warn("Could not deactivate old price:", oldPriceId, e);
      }
    }

    // ── Persist new price + product id + amount in country_settings ──
    const updatePayload: Record<string, unknown> = {
      [priceCol]: newPrice.id,
      [productCol]: productId,
      [amountCol]: amount,
    };
    const { error: updErr } = await supabase
      .from("country_settings")
      .update(updatePayload)
      .eq("code", country);
    if (updErr) throw updErr;

    // ── Audit log ──
    await supabase.from("plan_price_history").insert({
      country_code: country,
      plan,
      cycle,
      currency: currency.toUpperCase(),
      old_amount: oldAmount,
      new_amount: amount,
      old_stripe_price_id: oldPriceId,
      new_stripe_price_id: newPrice.id,
      stripe_product_id: productId,
      changed_by: userData.user.id,
      notes: body.notes ?? null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        country,
        plan,
        cycle,
        currency: currency.toUpperCase(),
        amount,
        stripe_product_id: productId,
        new_stripe_price_id: newPrice.id,
        old_stripe_price_id: oldPriceId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("admin-update-plan-price error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
