import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";
import { renderBrandedEmail } from "../_shared/branded-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;

const SUPER_ADMIN_EMAIL = "manelpereira11@gmail.com";

interface SendCampaignRequest {
  campaign_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (userData.user.email !== SUPER_ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden – super admin only" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { campaign_id }: SendCampaignRequest = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2) Service role client for full access
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: campaign, error: cErr } = await admin
      .from("admin_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (campaign.status === "sending" || campaign.status === "sent") {
      return new Response(JSON.stringify({ error: `Campaign already ${campaign.status}` }), {
        status: 409, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3) Build audience email list (deduplicated)
    const emails = new Map<string, { email: string; user_id: string | null; segment: string }>();

    const audience = campaign.audience as string;
    const country: string | null = campaign.country_filter;

    // ERP shops
    if (["all", "erp", "erp_free", "erp_paid"].includes(audience)) {
      let q = admin.from("shops").select("id, email, user_id, country, country_code");
      if (country) {
        // Match either country (legacy) or country_code (new)
        q = q.or(`country.eq.${country},country_code.eq.${country}`);
      }
      const { data: shops, error: shopsErr } = await q;
      if (shopsErr) console.error("[admin-send-campaign] shops query error:", shopsErr);

      let shopList = shops || [];

      // Filter by plan via subscriptions table when needed
      if (audience === "erp_free" || audience === "erp_paid") {
        const shopIds = shopList.map((s: any) => s.id);
        if (shopIds.length > 0) {
          const { data: subs } = await admin
            .from("subscriptions")
            .select("shop_id, plan, status")
            .in("shop_id", shopIds);
          const planByShop = new Map<string, string>();
          (subs || []).forEach((sub: any) => {
            // Latest subscription wins (table has updated_at, but we just take first)
            if (!planByShop.has(sub.shop_id)) planByShop.set(sub.shop_id, sub.plan || "free");
          });
          const wantPaid = audience === "erp_paid";
          shopList = shopList.filter((s: any) => {
            const plan = planByShop.get(s.id) || "free";
            const isPaid = ["pro", "garage"].includes(plan);
            return wantPaid ? isPaid : !isPaid;
          });
        } else if (audience === "erp_paid") {
          shopList = [];
        }
      }

      shopList.forEach((s: any) => {
        if (s.email && s.email.includes("@")) {
          emails.set(s.email.toLowerCase(), { email: s.email, user_id: s.user_id, segment: "erp" });
        }
      });
    }

    // Market sellers
    if (["all", "market", "market_sellers"].includes(audience)) {
      let q = admin.from("carity_seller_profiles").select("user_id, country_code");
      if (country) q = q.eq("country_code", country);
      const { data: sellers } = await q;
      if (sellers && sellers.length > 0) {
        // Need email from auth.users via RPC or admin API
        for (const s of sellers as any[]) {
          const { data: u } = await admin.auth.admin.getUserById(s.user_id);
          if (u?.user?.email) {
            const key = u.user.email.toLowerCase();
            if (!emails.has(key)) {
              emails.set(key, { email: u.user.email, user_id: s.user_id, segment: "market_seller" });
            }
          }
        }
      }
    }

    // Market buyers (everyone who has favorites or escrow as buyer)
    if (["all", "market", "market_buyers"].includes(audience)) {
      const { data: buyers } = await admin.from("market_escrow").select("buyer_id").limit(5000);
      const uniqueBuyers = new Set((buyers || []).map((b: any) => b.buyer_id).filter(Boolean));
      for (const buyerId of uniqueBuyers) {
        const { data: u } = await admin.auth.admin.getUserById(buyerId as string);
        if (u?.user?.email) {
          const key = u.user.email.toLowerCase();
          if (!emails.has(key)) {
            emails.set(key, { email: u.user.email, user_id: buyerId as string, segment: "market_buyer" });
          }
        }
      }
    }

    const recipientList = Array.from(emails.values());
    if (recipientList.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients matched audience" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 4) Mark campaign as sending and insert recipient rows
    await admin.from("admin_campaigns").update({
      status: "sending", recipients_count: recipientList.length,
    }).eq("id", campaign_id);

    const recipientRows = recipientList.map((r) => ({
      campaign_id, user_id: r.user_id, email: r.email, segment: r.segment, status: "pending",
    }));
    // Insert in batches of 500 to avoid payload limits
    for (let i = 0; i < recipientRows.length; i += 500) {
      await admin.from("admin_campaign_recipients").insert(recipientRows.slice(i, i + 500));
    }

    // 5) Send via Resend (sequential with small batching)
    const resend = new Resend(RESEND_KEY);
    let sent = 0;
    let failed = 0;

    for (const r of recipientList) {
      try {
        const { error } = await resend.emails.send({
          from: "GarageFlow <noreply@garageflow.pt>",
          to: [r.email],
          subject: campaign.subject,
          html: campaign.content_html,
        });
        if (error) {
          failed++;
          await admin.from("admin_campaign_recipients").update({
            status: "failed", error_message: error.message,
          }).eq("campaign_id", campaign_id).eq("email", r.email);
        } else {
          sent++;
          await admin.from("admin_campaign_recipients").update({
            status: "sent", sent_at: new Date().toISOString(),
          }).eq("campaign_id", campaign_id).eq("email", r.email);
        }
      } catch (err: any) {
        failed++;
        await admin.from("admin_campaign_recipients").update({
          status: "failed", error_message: err.message || String(err),
        }).eq("campaign_id", campaign_id).eq("email", r.email);
      }
      // tiny delay to respect Resend rate limit (~10/s safe)
      await new Promise((res) => setTimeout(res, 110));
    }

    await admin.from("admin_campaigns").update({
      status: "sent", sent_count: sent, failed_count: failed, sent_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({ success: true, sent, failed, total: recipientList.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("admin-send-campaign error:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
