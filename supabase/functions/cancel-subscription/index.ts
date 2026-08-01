// cancel-subscription — allows an authenticated shop OWNER to cancel their OWN subscription.
// Security: uses service_role but derives identity strictly from the JWT.
// It can ONLY cancel. It never changes `plan`, prices, or any billing identifiers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userData } = await supa.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as { shop_id?: string };
    const shopId = body.shop_id;
    if (!shopId) return json({ error: "Missing shop_id" }, 400);

    // Ownership check — only the shop owner (or the group owner) may cancel billing.
    const { data: shop, error: shopErr } = await supa
      .from("shops")
      .select("id, user_id, group_owner_id")
      .eq("id", shopId)
      .maybeSingle();
    if (shopErr) return json({ error: shopErr.message }, 500);
    if (!shop) return json({ error: "Shop not found" }, 404);

    const isOwner = shop.user_id === user.id || shop.group_owner_id === user.id;
    if (!isOwner) return json({ error: "Forbidden" }, 403);

    const { data: sub, error: subErr } = await supa
      .from("subscriptions")
      .select("id, shop_id, plan, status, current_period_end, stripe_subscription_id")
      .eq("shop_id", shopId)
      .maybeSingle();
    if (subErr) return json({ error: subErr.message }, 500);
    if (!sub) return json({ error: "No subscription found" }, 404);

    if (sub.stripe_subscription_id) {
      // Stripe-managed subscriptions must be cancelled through the Stripe portal/webhook.
      return json({ error: "STRIPE_MANAGED", message: "Use the billing portal to cancel." }, 409);
    }

    if (sub.status === "canceled" || sub.status === "cancelled") {
      return json({ success: true, already_canceled: true, subscription: sub });
    }

    // Cancel at the end of the current period when there is one in the future.
    const now = new Date();
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const effectiveEnd = periodEnd && periodEnd > now ? periodEnd : now;

    const { data: updated, error: updErr } = await supa
      .from("subscriptions")
      .update({
        status: "canceled",
        current_period_end: effectiveEnd.toISOString(),
        revenue_type: "free",
        updated_at: now.toISOString(),
      })
      .eq("shop_id", shopId)
      .select("id, shop_id, plan, status, current_period_end, updated_at")
      .maybeSingle();

    if (updErr) return json({ error: updErr.message }, 500);
    if (!updated) return json({ error: "Cancellation did not apply" }, 500);

    console.log("[CANCEL-SUB] cancelled", JSON.stringify({ user: user.id, shop: shopId }));
    return json({ success: true, subscription: updated, effective_at: effectiveEnd.toISOString() });
  } catch (e) {
    console.error("[CANCEL-SUB] error", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
