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
  debugId?: string;
}): Promise<
  | { ok: true; mode: "invite" | "recovery"; method: "inviteUserByEmail" | "resetPasswordForEmail"; userId?: string | null }
  | { ok: false; detail: string; attempts: Array<Record<string, unknown>> }
> {
  const debugId = params.debugId ?? crypto.randomUUID();
  const attempts: Array<Record<string, unknown>> = [];
  const audit = (step: string, details: Record<string, unknown> = {}) => {
    console.log(`[child-invite:${debugId}] ${step} ${JSON.stringify(details)}`);
  };

  const admin = createClient(params.supabaseUrl, params.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicClient = createClient(params.supabaseUrl, params.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prefer native invite (only works if user is not yet confirmed / not registered).
  if (params.mode === "invite") {
    audit("native_inviteUserByEmail_start", {
      email: params.email,
      redirectTo: params.redirectTo,
      provider: "native_auth_mailer",
    });
    const invite = await admin.auth.admin.inviteUserByEmail(params.email, {
      redirectTo: params.redirectTo,
      data: {
        source: "child_shop_invite",
        skip_shop_creation: "true",
        account_type: "garage_child",
        shop_name: params.shopName,
      },
    });
    attempts.push({
      method: "inviteUserByEmail",
      ok: !invite.error,
      status: (invite.error as any)?.status ?? null,
      message: invite.error?.message ?? null,
      userId: invite.data?.user?.id ?? null,
    });
    audit("native_inviteUserByEmail_result", attempts[attempts.length - 1]);
    if (!invite.error) {
      return { ok: true, mode: "invite", method: "inviteUserByEmail", userId: invite.data?.user?.id ?? null };
    }
    const msg = String(invite.error.message || "").toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
      return { ok: false, detail: `NATIVE_INVITE_FAILED: ${invite.error.message}`, attempts };
    }
    // Fall through to recovery for existing users.
  }

  audit("native_resetPasswordForEmail_start", {
    email: params.email,
    redirectTo: params.redirectTo,
    provider: "native_auth_mailer",
  });
  const recovery = await publicClient.auth.resetPasswordForEmail(params.email, {
    redirectTo: params.redirectTo,
  });
  attempts.push({
    method: "resetPasswordForEmail",
    ok: !recovery.error,
    status: (recovery.error as any)?.status ?? null,
    message: recovery.error?.message ?? null,
  });
  audit("native_resetPasswordForEmail_result", attempts[attempts.length - 1]);
  if (recovery.error) {
    return { ok: false, detail: `NATIVE_RECOVERY_FAILED: ${recovery.error.message}`, attempts };
  }
  return { ok: true, mode: "recovery", method: "resetPasswordForEmail" };
}
