// deno-lint-ignore-file no-explicit-any
// Native Supabase Auth fallback: sends the built-in invite/recovery email
// (from Supabase's default mailer, e.g. no-reply@auth.lovable.cloud) when
// the branded GarageFlow email fails to deliver.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export async function sendNativeAuthFallback(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  email: string;
  redirectTo: string;
  shopName: string;
  mode: "invite" | "recovery";
}): Promise<{ ok: true; mode: "invite" | "recovery" } | { ok: false; detail: string }> {
  const admin = createClient(params.supabaseUrl, params.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicClient = createClient(params.supabaseUrl, params.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prefer native invite (only works if user is not yet confirmed / not registered).
  if (params.mode === "invite") {
    const invite = await admin.auth.admin.inviteUserByEmail(params.email, {
      redirectTo: params.redirectTo,
      data: {
        source: "child_shop_invite",
        skip_shop_creation: "true",
        account_type: "garage_child",
        shop_name: params.shopName,
      },
    });
    if (!invite.error) return { ok: true, mode: "invite" };
    const msg = String(invite.error.message || "").toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
      return { ok: false, detail: `NATIVE_INVITE_FAILED: ${invite.error.message}` };
    }
    // Fall through to recovery for existing users.
  }

  const recovery = await publicClient.auth.resetPasswordForEmail(params.email, {
    redirectTo: params.redirectTo,
  });
  if (recovery.error) {
    return { ok: false, detail: `NATIVE_RECOVERY_FAILED: ${recovery.error.message}` };
  }
  return { ok: true, mode: "recovery" };
}
