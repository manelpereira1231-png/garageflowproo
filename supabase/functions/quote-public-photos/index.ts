import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || token.length < 8 || token.length > 100) return json({ photos: [] });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: q } = await admin
      .from("quotes")
      .select("id, shop_id, photos, share_photos, status, token_revoked_at, created_at")
      .eq("token", token)
      .maybeSingle();
    if (!q || q.token_revoked_at || q.status === "cancelled" || !q.share_photos) return json({ photos: [] });
    if (new Date(q.created_at).getTime() < Date.now() - 365 * 86400000) return json({ photos: [] });
    const prefix = `${q.shop_id}/${q.id}/`;
    const paths = (Array.isArray(q.photos) ? q.photos : [])
      .filter((p: unknown): p is string => typeof p === "string" && p.startsWith(prefix))
      .slice(0, 7);
    if (!paths.length) return json({ photos: [] });
    const { data } = await admin.storage.from("quote-photos").createSignedUrls(paths, 3600);
    return json({ photos: (data || []).map((d) => d.signedUrl).filter(Boolean) });
  } catch (e) {
    return json({ photos: [], error: String(e) }, 500);
  }
});
