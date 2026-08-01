import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Payload {
  shop_id: string;
  template_key: "welcome" | "first_quote" | "first_work_order" | "invoice_created" | string;
  entity_id: string;
  recipient: string;
  data?: Record<string, string | number | undefined>;
}

function interpolate(tpl: string, data: Record<string, any>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = data[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Auth guard: only the platform (cron / service role) may invoke
  const __auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    || (req.headers.get("x-internal-token") ?? "");
  if (__auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Payload;
    if (!body?.shop_id || !body?.template_key || !body?.entity_id || !body?.recipient) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipient)) {
      return new Response(JSON.stringify({ error: "Invalid recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency check
    const { data: prior } = await admin
      .from("email_lifecycle_log")
      .select("id")
      .eq("shop_id", body.shop_id)
      .eq("template_key", body.template_key)
      .eq("entity_id", body.entity_id)
      .maybeSingle();
    if (prior) {
      return new Response(JSON.stringify({ skipped: "already_sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tpl } = await admin
      .from("email_templates")
      .select("subject, html_body, enabled")
      .eq("shop_id", body.shop_id)
      .eq("template_key", body.template_key)
      .maybeSingle();

    if (!tpl || !tpl.enabled) {
      return new Response(JSON.stringify({ skipped: "template_disabled_or_missing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: shop } = await admin
      .from("shops")
      .select("name")
      .eq("id", body.shop_id)
      .maybeSingle();

    const merged = { shop_name: shop?.name ?? "GarageFlow", ...(body.data ?? {}) };
    const subject = interpolate(tpl.subject, merged);
    const html = interpolate(tpl.html_body, merged);

    const sendRes = await admin.functions.invoke("send-email", {
      body: {
        to: body.recipient,
        subject,
        html,
        branded: true,
        brand: "garageflow",
        preheader: subject,
        footerNote: `Recebeste este email porque a oficina ${merged.shop_name} usa o GarageFlow para comunicar contigo.`,
      },
    });

    const status = sendRes.error ? "failed" : "sent";
    await admin.from("email_lifecycle_log").insert({
      shop_id: body.shop_id,
      template_key: body.template_key,
      entity_id: body.entity_id,
      recipient: body.recipient,
      status,
      error: sendRes.error?.message ?? null,
    });

    return new Response(JSON.stringify({ ok: status === "sent", status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-lifecycle-email error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
