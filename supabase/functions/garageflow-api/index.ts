import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Authenticate via API key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing API key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = authHeader.replace("Bearer ", "");
    
    // Hash the key for lookup
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { data: apiKeyRecord } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("active", true)
      .maybeSingle();

    if (!apiKeyRecord) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit temporal (janela deslizante de 60s, 100 pedidos/min por chave)
    const { data: rl } = await supabase.rpc("check_and_bump_rate_limit", {
      _identifier: `api_key:${apiKeyRecord.id}`,
      _action: "garageflow_api",
      _max: 100,
      _window_seconds: 60,
    });
    if (rl && (rl as any).allowed === false) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retry_after_seconds: (rl as any).retry_after_seconds ?? 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String((rl as any).retry_after_seconds ?? 60),
          },
        }
      );
    }

    // Contador cumulativo (mantido para dashboard/estatísticas)
    await supabase.from("api_keys").update({
      request_count: (apiKeyRecord.request_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    }).eq("id", apiKeyRecord.id);

    const shopId = apiKeyRecord.shop_id;
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/garageflow-api\/?/, "").replace(/^\/+/, "");
    const method = req.method;

    // Route handling
    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Helper: extract ID from path like "clients/uuid"
    const pathParts = path.split("/");
    const resource = pathParts[0];
    const resourceId = pathParts[1] || null;

    // CLIENTS
    if (resource === "clients" && method === "GET" && !resourceId) {
      const { data, error } = await supabase.from("clients").select("*").eq("shop_id", shopId).is("deleted_at", null).order("name").limit(100);
      return json({ data, error: error?.message });
    }
    if (resource === "clients" && method === "GET" && resourceId) {
      const { data, error } = await supabase.from("clients").select("*").eq("id", resourceId).eq("shop_id", shopId).single();
      return json({ data, error: error?.message }, error ? 404 : 200);
    }
    if (resource === "clients" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("clients").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }
    if (resource === "clients" && method === "PUT" && resourceId) {
      const body = await req.json();
      delete body.shop_id; delete body.id;
      const { data, error } = await supabase.from("clients").update(body).eq("id", resourceId).eq("shop_id", shopId).select().single();
      return json({ data, error: error?.message }, error ? 400 : 200);
    }
    if (resource === "clients" && method === "DELETE" && resourceId) {
      const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", resourceId).eq("shop_id", shopId);
      return json({ success: !error, error: error?.message }, error ? 400 : 200);
    }

    // VEHICLES
    if (resource === "vehicles" && method === "GET" && !resourceId) {
      const { data, error } = await supabase.from("vehicles").select("*, clients(name)").eq("shop_id", shopId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }
    if (resource === "vehicles" && method === "GET" && resourceId) {
      const { data, error } = await supabase.from("vehicles").select("*, clients(name)").eq("id", resourceId).eq("shop_id", shopId).single();
      return json({ data, error: error?.message }, error ? 404 : 200);
    }
    if (resource === "vehicles" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("vehicles").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }
    if (resource === "vehicles" && method === "PUT" && resourceId) {
      const body = await req.json();
      delete body.shop_id; delete body.id;
      const { data, error } = await supabase.from("vehicles").update(body).eq("id", resourceId).eq("shop_id", shopId).select().single();
      return json({ data, error: error?.message }, error ? 400 : 200);
    }

    // QUOTES
    if (resource === "quotes" && method === "GET") {
      const { data, error } = await supabase.from("quotes").select("*, clients(name), vehicles(make, model, plate)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }

    // SERVICES (service catalog)
    if (resource === "services" && method === "GET") {
      const { data, error } = await supabase.from("service_catalog").select("*").eq("shop_id", shopId).eq("active", true).order("name");
      return json({ data, error: error?.message });
    }
    if (resource === "services" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("service_catalog").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }

    // WORK ORDERS
    if (resource === "work-orders" && method === "GET") {
      const { data, error } = await supabase.from("work_orders").select("*, clients(name), vehicles(make, model, plate)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }

    // INVOICES
    if (resource === "invoices" && method === "GET") {
      const { data, error } = await supabase.from("invoices").select("*, clients(name)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }

    // APPOINTMENTS
    if (resource === "appointments" && method === "GET") {
      const { data, error } = await supabase.from("appointments").select("*").eq("shop_id", shopId).order("date", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }
    if (resource === "appointments" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("appointments").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }

    return json({ error: "Not found", available: ["/clients", "/clients/:id", "/vehicles", "/vehicles/:id", "/quotes", "/services", "/work-orders", "/invoices", "/appointments"] }, 404);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
