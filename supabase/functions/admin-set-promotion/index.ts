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

interface Body {
  country_code: string;
  plan: Plan;
  cycle: Cycle;
  promo_price?: number;      // in major units (e.g. 14.99). Required unless action='delete'
  active?: boolean;
  starts_at?: string | null; // ISO
  ends_at?: string | null;   // ISO
  notes?: string;
  action?: "upsert" | "delete" | "deactivate";
}

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
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

    // Auth: super admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return badRequest("missing_authorization", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return badRequest("not_authenticated", 401);

    const { data: isAdmin } = await supabase.rpc("is_super_admin", {
      _user_id: userData.user.id,
    });
    if (!isAdmin) return badRequest("forbidden", 403);

    const body = (await req.json()) as Body;
    const country = String(body.country_code || "").toUpperCase().trim();
    const plan = body.plan;
    const cycle = body.cycle;
    const action = body.action || "upsert";

    if (!country) return badRequest("country_code_required");
    if (plan !== "free" && plan !== "pro" && plan !== "garage") return badRequest("plan_invalid");
    if (cycle !== "monthly" && cycle !== "yearly") return badRequest("cycle_invalid");

    // Load country settings for currency + base amount + product id
    const { data: countryRow, error: countryErr } = await supabase
      .from("country_settings")
      .select("*")
      .eq("code", country)
      .maybeSingle();
    if (countryErr) throw countryErr;
    if (!countryRow) return badRequest("country_not_found");

    const currency = (countryRow.currency || "EUR").toLowerCase();
    const productCol = `stripe_${plan}_product_id`;
    const amountCol = `saas_${plan}_${cycle}`;
    const baseAmount = Number((countryRow as any)[amountCol] || 0);
    let productId: string | null = (countryRow as any)[productCol] ?? null;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch existing promo (if any) so we can deactivate its old Stripe price
    const { data: existing } = await supabase
      .from("plan_promotions")
      .select("*")
      .eq("country_code", country)
      .eq("plan", plan)
      .eq("cycle", cycle)
      .maybeSingle();

    // ── DELETE: remove promotion entirely, deactivate Stripe price ──
    if (action === "delete") {
      if (existing?.stripe_price_id) {
        try { await stripe.prices.update(existing.stripe_price_id, { active: false }); }
        catch (e) { console.warn("[admin-set-promotion] deactivate old promo price failed", e); }
      }
      const { error: delErr } = await supabase
        .from("plan_promotions")
        .delete()
        .eq("country_code", country)
        .eq("plan", plan)
        .eq("cycle", cycle);
      if (delErr) throw delErr;
      return new Response(JSON.stringify({ ok: true, deleted: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE: keep row for history, but mark inactive + deactivate Stripe price ──
    if (action === "deactivate") {
      if (existing?.stripe_price_id) {
        try { await stripe.prices.update(existing.stripe_price_id, { active: false }); }
        catch (e) { console.warn("[admin-set-promotion] deactivate old promo price failed", e); }
      }
      const { error: updErr } = await supabase
        .from("plan_promotions")
        .update({ active: false })
        .eq("country_code", country)
        .eq("plan", plan)
        .eq("cycle", cycle);
      if (updErr) throw updErr;
      return new Response(JSON.stringify({ ok: true, deactivated: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPSERT: create/update promotion ──
    const promoPrice = Number(body.promo_price);
    if (!Number.isFinite(promoPrice) || promoPrice < 0) return badRequest("promo_price_invalid");
    if (baseAmount > 0 && promoPrice >= baseAmount) return badRequest("promo_price_must_be_less_than_base");

    const activeFlag = body.active !== false; // default true
    const startsAt = body.starts_at ? new Date(body.starts_at).toISOString() : null;
    const endsAt = body.ends_at ? new Date(body.ends_at).toISOString() : null;
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      return badRequest("invalid_date_range");
    }

    // Ensure Stripe product exists (create if country has none for this plan)
    if (!productId && promoPrice > 0) {
      const product = await stripe.products.create({
        name: `GarageFlow ${plan === "pro" ? "Pro" : plan === "garage" ? "Garage" : "Start"} — ${country}`,
        metadata: { country, plan, source: "admin-set-promotion" },
      });
      productId = product.id;

      // Persist product id back on country_settings for future reuse
      await supabase
        .from("country_settings")
        .update({ [productCol]: productId })
        .eq("code", country);
    }

    // Deactivate previous promo Stripe price if amount changed
    let newStripePriceId: string | null = existing?.stripe_price_id ?? null;
    const amountChanged = !existing || Number(existing.promo_price) !== promoPrice;

    if (amountChanged && promoPrice > 0 && productId) {
      // Deactivate old
      if (existing?.stripe_price_id) {
        try { await stripe.prices.update(existing.stripe_price_id, { active: false }); }
        catch (e) { console.warn("[admin-set-promotion] deactivate old promo price failed", e); }
      }
      const newPrice = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: Math.round(promoPrice * 100),
        recurring: { interval: cycle === "yearly" ? "year" : "month" },
        metadata: { country, plan, cycle, source: "admin-set-promotion", kind: "promotion" },
      });
      newStripePriceId = newPrice.id;
    }

    const payload = {
      country_code: country,
      plan,
      cycle,
      promo_price: promoPrice,
      currency: currency.toUpperCase(),
      stripe_price_id: newStripePriceId,
      stripe_product_id: productId,
      active: activeFlag,
      starts_at: startsAt,
      ends_at: endsAt,
      notes: body.notes ?? null,
      created_by: userData.user.id,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("plan_promotions")
      .upsert(payload, { onConflict: "country_code,plan,cycle" });
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({
        ok: true,
        country,
        plan,
        cycle,
        promo_price: promoPrice,
        base_amount: baseAmount,
        discount_percent: baseAmount > 0
          ? Math.max(0, Math.round(((baseAmount - promoPrice) / baseAmount) * 100))
          : 0,
        stripe_price_id: newStripePriceId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[admin-set-promotion] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
