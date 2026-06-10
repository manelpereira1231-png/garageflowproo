// Observability wrapper for edge functions.
// Logs every request to public.api_logs (endpoint, latency, status, error, user_id, ip).
//
// Usage:
//   import { withApiLog } from "../_shared/with-api-log.ts";
//   serve(withApiLog("my-fn", async (req) => { ... }));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function getIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    null
  );
}

async function getUserId(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const { data } = await admin.auth.getUser(auth.slice(7));
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export function withApiLog(
  endpoint: string,
  handler: (req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    const start = performance.now();
    let status = 500;
    let errorMsg: string | null = null;
    let res: Response;
    try {
      res = await handler(req);
      status = res.status;
      return res;
    } catch (e: any) {
      errorMsg = e?.message ?? String(e);
      throw e;
    } finally {
      const latency = Math.round(performance.now() - start);
      const ip = getIp(req);
      const userId = await getUserId(req).catch(() => null);
      // Fire-and-forget; never block the response.
      admin
        .from("api_logs")
        .insert({
          endpoint,
          method: req.method,
          status_code: status,
          latency_ms: latency,
          user_id: userId,
          ip_address: ip,
          error: errorMsg,
        })
        .then(() => {})
        .catch(() => {});
    }
  };
}
