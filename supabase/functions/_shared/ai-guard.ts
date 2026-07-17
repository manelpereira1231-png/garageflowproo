// Shared AI cost-control guard for Lovable Cloud edge functions.
// Enforces: JWT, cache, rate limit, global budget (with safety margin), per-plan quota.
// Do NOT bypass this guard on any AI-invoking edge function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type GuardResult =
  | { ok: true; userId: string; supa: ReturnType<typeof createClient>; cacheKey: string; promptHash: string; cached: null; saveCache: (resp: unknown, ttl?: number) => Promise<void> }
  | { ok: true; userId: string; supa: ReturnType<typeof createClient>; cacheKey: string; promptHash: string; cached: unknown; saveCache: (resp: unknown, ttl?: number) => Promise<void> }
  | { ok: false; response: Response };

export interface GuardOptions {
  req: Request;
  shopId?: string | null;
  functionName: string;
  prompt: string; // canonical prompt string used for cache key
  cost?: number; // credits, default 1
  useCache?: boolean; // default true
  metadata?: Record<string, unknown>;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text.toLowerCase().trim());
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Enforce all AI cost-control checks. Call at the very top of any edge function
 * that would otherwise dispatch to Lovable AI Gateway.
 *
 * Returns either:
 *  - { ok: true, cached }  → serve `cached` immediately if not null (0 credits, already logged)
 *  - { ok: true, cached: null, saveCache } → proceed with model call, then `await saveCache(response)`
 *  - { ok: false, response } → return `response` directly (401 / 402 / 403 / 429)
 */
export async function guardAiCall(opts: GuardOptions): Promise<GuardResult> {
  const { req, shopId, functionName, prompt, cost = 1, useCache = true, metadata = {} } = opts;

  // 1. Auth
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }
  const userId = userData.user.id;

  if (!shopId) {
    return { ok: false, response: jsonResponse({ error: "Missing shop_id" }, 400) };
  }

  const promptHash = await sha256(prompt || "");
  const cacheKey = `${shopId}:${functionName}:${promptHash}`;

  // 2. Cache lookup
  if (useCache) {
    try {
      const { data: cached } = await supa.rpc("ai_try_cache", { _cache_key: cacheKey });
      if (cached) {
        // log the cache hit for stats (0 credits, cached=true)
        await supa.rpc("ai_log_cache_hit", {
          _shop_id: shopId,
          _function_name: functionName,
          _prompt_hash: promptHash,
        });
        return {
          ok: true,
          userId,
          supa,
          cacheKey,
          promptHash,
          cached,
          saveCache: async () => {},
        };
      }
    } catch (_) { /* non-fatal */ }
  }

  // 3. Consume credit (rate limit + budget + plan quota happen server-side)
  const { data: creditRes, error: creditErr } = await supa.rpc("consume_ai_credit", {
    _shop_id: shopId,
    _function_name: functionName,
    _cost: cost,
    _metadata: { ...metadata, prompt_hash: promptHash },
  });
  if (creditErr) {
    return { ok: false, response: jsonResponse({ error: "credit_check_failed", detail: creditErr.message }, 500) };
  }
  const allowed = (creditRes as { allowed?: boolean })?.allowed;
  if (!allowed) {
    const reason = (creditRes as { reason?: string })?.reason || "quota_exceeded";
    const status =
      reason === "rate_limited" ? 429 :
      reason === "plan_no_ai" || reason === "not_a_member" || reason === "no_subscription" ? 403 :
      reason === "global_budget_exceeded" ? 402 :
      reason === "unauthorized" ? 401 :
      402;
    return {
      ok: false,
      response: jsonResponse({ error: reason, quota: creditRes }, status),
    };
  }

  // 4. Prepare save-cache helper for post-call
  const saveCache = useCache
    ? async (response: unknown, ttl?: number) => {
        // Use service role to write — fall back silently on any error
        try {
          const svc = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
          );
          await svc.rpc("ai_save_cache", {
            _cache_key: cacheKey,
            _shop_id: shopId,
            _function_name: functionName,
            _response: response as unknown as Record<string, unknown>,
            _ttl_seconds: ttl ?? null,
          });
        } catch (_) { /* non-fatal */ }
      }
    : async () => {};

  return { ok: true, userId, supa, cacheKey, promptHash, cached: null, saveCache };
}
