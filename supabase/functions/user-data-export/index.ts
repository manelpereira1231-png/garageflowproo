// User data export (RGPD art. 15 + 20). Returns a JSON dump of all user data.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return j({ error: "unauthorized" }, 401);

    // Use service role to gather all data the user owns
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const uid = user.id;

    const [
      shops, shopUsers, subs, partners, referrals,
      sellerProfile, listings, escrow, contracts, favorites, alerts,
    ] = await Promise.all([
      admin.from("shops").select("*").eq("user_id", uid),
      admin.from("shop_users").select("*").eq("user_id", uid),
      admin.from("subscriptions").select("*").in("shop_id",
        (await admin.from("shops").select("id").eq("user_id", uid)).data?.map((s: any) => s.id) ?? []
      ),
      admin.from("partners").select("*").eq("auth_user_id", uid),
      admin.from("referrals").select("*").or(`referrer_user_id.eq.${uid},referred_user_id.eq.${uid}`),
      admin.from("carity_seller_profiles").select("*").eq("user_id", uid),
      admin.from("carity_listings").select("*").eq("seller_id", uid),
      admin.from("market_escrow").select("*").or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      admin.from("market_contracts").select("*").or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      admin.from("listing_favorites").select("*").eq("user_id", uid),
      admin.from("listing_alerts").select("*").eq("user_id", uid),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      gdpr_notice:
        "Este ficheiro contém os dados pessoais associados à tua conta GarageFlow. Conserva-o em local seguro.",
      account: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        metadata: user.user_metadata,
      },
      saas: {
        shops: shops.data ?? [],
        shop_memberships: shopUsers.data ?? [],
        subscriptions: subs.data ?? [],
      },
      market: {
        seller_profile: sellerProfile.data ?? [],
        listings: listings.data ?? [],
        escrow_transactions: escrow.data ?? [],
        contracts: contracts.data ?? [],
        favorites: favorites.data ?? [],
        alerts: alerts.data ?? [],
      },
      partner_program: {
        partner: partners.data ?? [],
        referrals: referrals.data ?? [],
      },
    };

    // Audit log (best-effort)
    try {
      await admin.from("audit_logs").insert({
        user_id: uid,
        action: "gdpr_data_export",
        entity_type: "user",
        entity_id: uid,
        details: { exported_at: payload.exported_at },
      });
    } catch { /* ignore */ }

    return j(payload, 200);
  } catch (e: any) {
    return j({ error: e.message ?? "internal_error" }, 500);
  }
});

function j(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
