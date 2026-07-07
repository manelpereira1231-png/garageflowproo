import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 🔒 Auth: exigir JWT do próprio utilizador que está a ser atribuído.
    // Sem isto, qualquer pessoa poderia atribuir comissões a shops arbitrários.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { partner_id, user_id, email, shop_name } = await req.json();

    if (!partner_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing partner_id or user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller só pode atribuir referral em nome do PRÓPRIO utilizador recém-criado.
    if (callerId !== user_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Janela temporal: só permitir atribuição nas primeiras 24h após criação da conta.
    const createdAt = userData.user.created_at ? new Date(userData.user.created_at).getTime() : 0;
    if (createdAt && Date.now() - createdAt > 24 * 60 * 60 * 1000) {
      return new Response(JSON.stringify({ error: "Signup window expired" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify partner exists and is active
    const { data: partner } = await supabase
      .from("partners")
      .select("id, status, contact_email, commission_percentage")
      .eq("id", partner_id)
      .maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (partner.status !== "active") {
      await supabase.from("partner_logs").insert({
        partner_id, action: "signup_blocked_inactive",
        details: { user_id, email, reason: "partner_inactive" },
      });
      return new Response(JSON.stringify({ error: "Partner inactive" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-fraud: Check if this email is suspiciously similar to the partner's
    const partnerEmailDomain = partner.contact_email?.split("@")[1]?.toLowerCase();
    const userEmailDomain = email?.split("@")[1]?.toLowerCase();
    const isSuspicious = partnerEmailDomain && userEmailDomain && 
      partnerEmailDomain === userEmailDomain && 
      !["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "live.com", "sapo.pt", "mail.com"].includes(partnerEmailDomain);

    // Wait a moment for the shop to be auto-created by the trigger
    await new Promise(r => setTimeout(r, 2000));

    // Find the shop created for this user
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!shop) {
      // Retry once more after delay
      await new Promise(r => setTimeout(r, 3000));
      const { data: shop2 } = await supabase
        .from("shops")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .maybeSingle();
      
      if (!shop2) {
        await supabase.from("partner_logs").insert({
          partner_id, action: "workshop_signup_no_shop",
          details: { user_id, email },
        });
        return new Response(JSON.stringify({ ok: true, warning: "Shop not found yet" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use shop2
      await createReferral(supabase, partner_id, shop2.id, partner.commission_percentage, user_id, email, shop_name, isSuspicious);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-fraud: Check if this shop is already linked to another partner
    const { data: existingRef } = await supabase
      .from("partner_referrals")
      .select("id")
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (existingRef) {
      await supabase.from("partner_logs").insert({
        partner_id, action: "duplicate_referral_blocked",
        details: { shop_id: shop.id, user_id, email, existing_referral: existingRef.id },
      });
      return new Response(JSON.stringify({ ok: true, warning: "Shop already referred" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await createReferral(supabase, partner_id, shop.id, partner.commission_percentage, user_id, email, shop_name, isSuspicious);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Track affiliate error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createReferral(
  supabase: any, partnerId: string, shopId: string, commissionRate: number,
  userId: string, email: string, shopName: string, isSuspicious: boolean
) {
  // Create partner_referrals entry
  await supabase.from("partner_referrals").insert({
    partner_id: partnerId,
    shop_id: shopId,
    commission_rate: commissionRate,
  });

  // Log the signup
  await supabase.from("partner_logs").insert({
    partner_id: partnerId,
    action: isSuspicious ? "workshop_signed_up_suspicious" : "workshop_signed_up",
    details: {
      user_id: userId,
      email,
      shop_id: shopId,
      shop_name: shopName || "",
      source: "affiliate_link",
      suspicious: isSuspicious,
    },
  });
}
