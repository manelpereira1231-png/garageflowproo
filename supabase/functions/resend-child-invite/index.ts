// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * resend-child-invite
 * -------------------
 * Re-sends the official password setup email to a child shop account.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URL =
  Deno.env.get("CHILD_SHOP_INVITE_REDIRECT") ??
  "https://garageflow-pt.lovable.app/reset-password?realm=erp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const publicAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) return json({ error: "NOT_AUTHENTICATED" }, 401);
    const caller = userRes.user;

    const { shop_id } = await req.json().catch(() => ({}));
    if (!shop_id) return json({ error: "MISSING_SHOP_ID" }, 400);

    const { data: shop } = await admin
      .from("shops")
      .select("id, user_id, group_owner_id, email, name")
      .eq("id", shop_id)
      .maybeSingle();

    if (!shop) return json({ error: "SHOP_NOT_FOUND" }, 404);
    if (shop.group_owner_id !== caller.id) return json({ error: "NOT_GROUP_OWNER" }, 403);
    if (shop.user_id === caller.id) return json({ error: "CANNOT_RESET_PRIMARY" }, 400);

    const { data: child, error: getErr } = await admin.auth.admin.getUserById(shop.user_id);
    if (getErr || !child?.user?.email) return json({ error: "CHILD_USER_NOT_FOUND" }, 404);

    const childEmail = child.user.email;
    let authEmailMode: "invite" | "recovery" = child.user.email_confirmed_at ? "recovery" : "invite";

    if (authEmailMode === "invite") {
      const invite = await admin.auth.admin.inviteUserByEmail(childEmail, {
        redirectTo: REDIRECT_URL,
        data: { source: "child_shop_invite", shop_name: shop.name ?? "" },
      });
      if (invite.error) {
        const msg = String(invite.error.message || "").toLowerCase();
        if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
          return json({ error: "INVITE_EMAIL_FAILED", detail: invite.error.message }, 500);
        }
        authEmailMode = "recovery";
      }
    }

    if (authEmailMode === "recovery") {
      const reset = await publicAuth.auth.resetPasswordForEmail(childEmail, {
        redirectTo: REDIRECT_URL,
      });
      if (reset.error) {
        return json({ error: "PASSWORD_EMAIL_FAILED", detail: reset.error.message }, 500);
      }
    }

    return json({ ok: true, auth_email: authEmailMode }, 200);
  } catch (e: any) {
    return json({ error: "UNEXPECTED", detail: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}