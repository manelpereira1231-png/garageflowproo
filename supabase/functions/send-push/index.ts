import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// VAPID keys loaded from secrets. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in project secrets.
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

// Web Push utilities using Web Crypto API
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateJWT(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:noreply@garageflow.pt",
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    await convertRawToPKCS8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r|s format for JWT
  const sigArray = new Uint8Array(signature);
  const sigB64 = uint8ArrayToBase64Url(sigArray);

  return `${unsignedToken}.${sigB64}`;
}

async function convertRawToPKCS8(rawKey: Uint8Array): Promise<ArrayBuffer> {
  // ASN.1 PKCS#8 wrapper for EC P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // Get public key from private key
  const pubKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY);

  const result = new Uint8Array(prefix.length + rawKey.length + suffix.length + pubKeyBytes.length);
  result.set(prefix, 0);
  result.set(rawKey, prefix.length);
  result.set(suffix, prefix.length + rawKey.length);
  result.set(pubKeyBytes, prefix.length + rawKey.length + suffix.length);

  return result.buffer;
}

async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<boolean> {
  try {
    const jwt = await generateJWT(subscription.endpoint);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        TTL: "86400",
      },
      body: new TextEncoder().encode(payload),
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired — should be cleaned up
      return false;
    }

    return response.ok;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body_json = await req.json();
    const { action, shop_id, title, body, url, user_ids } = body_json;

    // Client portal push subscription — requires a valid portal_token matching client_id+shop_id,
    // OR an authenticated user that owns/belongs to the shop.
    if (action === "subscribe") {
      const { client_id, endpoint, p256dh, auth, portal_token } = body_json;
      if (!shop_id || !client_id || !endpoint || !p256dh || !auth) {
        return new Response(JSON.stringify({ error: "Missing fields for subscribe" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authenticate either via portal_token or via user JWT.
      let allowed = false;
      if (portal_token) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, shop_id, portal_token")
          .eq("id", client_id)
          .eq("shop_id", shop_id)
          .eq("portal_token", portal_token)
          .maybeSingle();
        allowed = !!client;
      }
      if (!allowed) {
        const authHeader = req.headers.get("Authorization") || "";
        if (authHeader.startsWith("Bearer ")) {
          const { data: u } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
          if (u?.user) {
            const [{ data: mem }, { data: own }] = await Promise.all([
              supabase.from("shop_users").select("shop_id").eq("user_id", u.user.id).eq("shop_id", shop_id).limit(1),
              supabase.from("shops").select("id").eq("id", shop_id).eq("user_id", u.user.id).limit(1),
            ]);
            allowed = (mem?.length ?? 0) > 0 || (own?.length ?? 0) > 0;
          }
        }
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const portalUserId = client_id;
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("shop_id", shop_id)
        .eq("user_id", portalUserId);

      const { error: insertErr } = await supabase
        .from("push_subscriptions")
        .insert({ shop_id, user_id: portalUserId, endpoint, p256dh, auth });

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!shop_id || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing shop_id, title, or body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate caller for notification-sending path
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bearer = authHeader.replace("Bearer ", "");
    const isService = bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isService) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(bearer);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: memberRows } = await supabase
        .from("shop_users").select("shop_id").eq("user_id", userData.user.id).eq("shop_id", shop_id).limit(1);
      const { data: ownerRows } = await supabase
        .from("shops").select("id").eq("id", shop_id).eq("user_id", userData.user.id).limit(1);
      if ((memberRows?.length ?? 0) === 0 && (ownerRows?.length ?? 0) === 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID_PRIVATE_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subscriptions
    let query = supabase
      .from("push_subscriptions")
      .select("*")
      .eq("shop_id", shop_id);

    if (user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body, url: url || "/dashboard" });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of (subscriptions || [])) {
      const ok = await sendPushToSubscription(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      );
      if (ok) {
        sent++;
      } else {
        failed++;
        expiredEndpoints.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, failed, total: (subscriptions || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
