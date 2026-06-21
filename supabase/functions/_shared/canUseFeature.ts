// Shared helper for Lovable-managed edge functions: feature gating
// backed by the public.user_can_use_feature RPC.
//
// Usage:
//   import { ensureFeature } from "../_shared/canUseFeature.ts";
//   await ensureFeature(req, "marketing");
//
// Throws Response(403) when the caller's plan does not include the
// requested feature. Returns the userId on success.

import { createClient } from "npm:@supabase/supabase-js@2";

export async function ensureFeature(req: Request, featureSlug: string): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await client.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: allowed, error } = await client.rpc("user_can_use_feature", {
    _user_id: userData.user.id,
    _feature: featureSlug,
  });

  if (error || !allowed) {
    throw new Response(
      JSON.stringify({
        error: "feature_not_in_plan",
        feature: featureSlug,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return userData.user.id;
}
