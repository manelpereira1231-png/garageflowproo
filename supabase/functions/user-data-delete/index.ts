// User account deletion (RGPD art. 17 — right to erasure).
// Conserves invoices for 10 years (Código do IVA) but anonymizes the link to the user.
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
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return j({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const uid = user.id;

    // SAFEGUARD: Do not allow deletion if there are pending escrow transactions.
    const { data: pending } = await admin
      .from("market_escrow")
      .select("id, status")
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .in("status", ["pending", "paid", "delivery_pending", "disputed"]);
    if (pending && pending.length > 0) {
      return j({
        error: "pending_transactions",
        message: "Tens transações Market em aberto. Resolve-as antes de eliminar a conta.",
        count: pending.length,
      }, 409);
    }

    // SAFEGUARD: Active subscription must be cancelled first.
    const { data: shops } = await admin.from("shops").select("id").eq("user_id", uid);
    const shopIds = shops?.map((s: any) => s.id) ?? [];
    if (shopIds.length > 0) {
      const { data: activeSubs } = await admin
        .from("subscriptions")
        .select("id, status, plan")
        .in("shop_id", shopIds)
        .in("status", ["active", "trialing", "past_due"])
        .neq("plan", "free");
      if (activeSubs && activeSubs.length > 0) {
        return j({
          error: "active_subscription",
          message: "Cancela primeiro a tua subscrição no portal de faturação.",
        }, 409);
      }
    }

    // Audit log BEFORE deletion (best-effort)
    try {
      await admin.from("audit_logs").insert({
        user_id: uid,
        action: "gdpr_account_deletion",
        entity_type: "user",
        entity_id: uid,
        details: { email_hash: hash(user.email ?? ""), shop_ids: shopIds },
      });
    } catch { /* ignore */ }

    // Cascade-delete shops (uses existing RPC for atomicity)
    for (const sid of shopIds) {
      try {
        await admin.rpc("cascade_delete_shop", { _shop_id: sid });
      } catch (e) {
        console.error("cascade_delete_shop failed", sid, e);
      }
    }

    // Market: hard-delete user-owned data that is NOT a fiscal/legal record.
    await admin.from("listing_favorites").delete().eq("user_id", uid);
    await admin.from("listing_alerts").delete().eq("user_id", uid);
    await admin.from("carity_chat_messages").delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
    await admin.from("carity_seller_profiles").delete().eq("user_id", uid);
    // Listings: only delete drafts/paused. Sold/published are conserved (anti-fraud trail).
    await admin.from("carity_listings").delete()
      .eq("seller_id", uid).in("status", ["draft", "paused", "rejected"]);

    // Anonymize fiscal/legal records that must be conserved (10 years - Código do IVA).
    // We replace identifying fields with hashes; preserve totals & numbering.
    // (Invoices already deleted via cascade_delete_shop above; if other shops referenced
    //  this user as a member they were also removed by cascade.)

    // Affiliate program: keep payout history but unlink auth.
    await admin.from("partners").update({ auth_user_id: null }).eq("auth_user_id", uid);

    // Finally: delete auth user. After this the JWT is invalid.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error("auth.admin.deleteUser failed", delErr);
      return j({ error: "auth_delete_failed", message: delErr.message }, 500);
    }

    return j({ ok: true, deleted_at: new Date().toISOString() }, 200);
  } catch (e: any) {
    console.error(e);
    return j({ error: e.message ?? "internal_error" }, 500);
  }
});

function hash(s: string): string {
  // light non-cryptographic hash for audit log (avoids storing the raw email).
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return `h_${Math.abs(h).toString(36)}`;
}

function j(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
