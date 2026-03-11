import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Rate limiting check (simple: per minute)
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

    // CLIENTS
    if (path === "clients" && method === "GET") {
      const { data, error } = await supabase.from("clients").select("*").eq("shop_id", shopId).is("deleted_at", null).order("name").limit(100);
      return json({ data, error: error?.message });
    }
    if (path === "clients" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("clients").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }

    // VEHICLES
    if (path === "vehicles" && method === "GET") {
      const { data, error } = await supabase.from("vehicles").select("*, clients(name)").eq("shop_id", shopId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }
    if (path === "vehicles" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("vehicles").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }

    // QUOTES
    if (path === "quotes" && method === "GET") {
      const { data, error } = await supabase.from("quotes").select("*, clients(name), vehicles(make, model, plate)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }

    // WORK ORDERS
    if (path === "work-orders" && method === "GET") {
      const { data, error } = await supabase.from("work_orders").select("*, clients(name), vehicles(make, model, plate)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }

    // INVOICES
    if (path === "invoices" && method === "GET") {
      const { data, error } = await supabase.from("invoices").select("*, clients(name)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }

    // APPOINTMENTS
    if (path === "appointments" && method === "GET") {
      const { data, error } = await supabase.from("appointments").select("*").eq("shop_id", shopId).order("date", { ascending: false }).limit(100);
      return json({ data, error: error?.message });
    }
    if (path === "appointments" && method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("appointments").insert({ ...body, shop_id: shopId }).select().single();
      return json({ data, error: error?.message }, error ? 400 : 201);
    }

    return json({ error: "Not found", available: ["/clients", "/vehicles", "/quotes", "/work-orders", "/invoices", "/appointments"] }, 404);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
