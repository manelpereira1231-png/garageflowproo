/**
 * SALES DEMO — sessão de demonstração comercial.
 *
 * Cria/garante UMA conta de demonstração isolada (oficina "AutoPrime Lisboa"),
 * com dados fictícios, e devolve uma sessão pronta a usar no ERP real.
 * Nunca toca em contas, planos ou dados de clientes reais.
 *
 * Actions:
 *   start  -> garante conta + dados + plano escolhido, devolve session
 *   plan   -> muda o plano APENAS da oficina demo
 *   reset  -> apaga e volta a semear os dados da oficina demo
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "demo@garageflow.pt";
const DEMO_SHOP_NAME = "AutoPrime Lisboa";
const PLANS = ["free", "pro", "garage"] as const;
type Plan = typeof PLANS[number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function randomPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "start";
    const plan: Plan = PLANS.includes(body.plan) ? body.plan : "pro";

    /* ---------------------------------------------------------- demo user */
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)?.id ?? null;

    const password = randomPassword();
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: "GarageFlow Demo", is_demo: true },
      });
      if (error) return json({ error: error.message }, 400);
      userId = created.user!.id;
    } else {
      // rotaciona a password a cada demonstração (nunca é exposta ao browser)
      const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
    }

    /* ---------------------------------------------------------- demo shop */
    // O signup cria automaticamente uma oficina — reutilizamo-la (sem criar mais).
    let { data: shop } = await admin
      .from("shops").select("id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();

    const shopFields = {
      name: DEMO_SHOP_NAME,
      email: DEMO_EMAIL,
      phone: "+351 210 000 000",
      address: "Av. da República 120, Lisboa",
      currency: "EUR",
      language: "pt",
      timezone: "Europe/Lisbon",
      vat_rate: 23,
      labor_rate: 45,
      nif: "999999990",
      status: "active",
      onboarding_completed_at: new Date().toISOString(),
    };

    if (shop) {
      await admin.from("shops").update(shopFields).eq("id", shop.id);
    } else {
      const { data: newShop, error } = await admin.from("shops").insert({
        user_id: userId,
        group_owner_id: userId,
        country: "PT",
        country_code: "PT",
        ...shopFields,
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      shop = newShop;
    }
    const shopId = shop!.id as string;

    /* ------------------------------------------------------------- plano */
    const { data: sub } = await admin.from("subscriptions").select("id").eq("shop_id", shopId).maybeSingle();
    if (sub) {
      await admin.from("subscriptions").update({ plan, status: "active", updated_at: new Date().toISOString() }).eq("id", sub.id);
    } else {
      await admin.from("subscriptions").insert({ shop_id: shopId, plan, status: "active", billing_cycle: "monthly" });
    }

    if (action === "plan") return json({ ok: true, shop_id: shopId, plan });

    /* -------------------------------------------------------- seed / reset */
    const wipe = async () => {
      for (const table of ["invoices", "work_orders", "quotes", "vehicles", "clients", "parts"]) {
        await admin.from(table).delete().eq("shop_id", shopId);
      }
    };

    const { count: clientCount } = await admin
      .from("clients").select("id", { count: "exact", head: true }).eq("shop_id", shopId);

    if (action === "reset" || !clientCount) {
      if (action === "reset") await wipe();
      await seed(admin, shopId);
    }

    if (action === "reset") return json({ ok: true, shop_id: shopId, plan });

    /* ---------------------------------------------------------- sessão */
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
      email: DEMO_EMAIL, password,
    });
    if (signInError) return json({ error: signInError.message }, 400);

    return json({
      ok: true,
      shop_id: shopId,
      plan,
      session: {
        access_token: signIn.session!.access_token,
        refresh_token: signIn.session!.refresh_token,
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

/* ------------------------------------------------------------------ seed */

async function seed(admin: any, shopId: string) {
  const clients = [
    { name: "Ana Marques", phone: "+351 912 000 111", email: "ana.marques@exemplo.pt", nif: "210000001" },
    { name: "Transportes Belém, Lda.", phone: "+351 213 000 222", email: "frota@belem-exemplo.pt", company: "Transportes Belém", nif: "510000002", is_fleet: true, fleet_name: "Frota Belém" },
    { name: "Rui Cardoso", phone: "+351 936 000 333", email: "rui.cardoso@exemplo.pt", nif: "210000003" },
    { name: "Sofia Almeida", phone: "+351 927 000 444", email: "sofia.almeida@exemplo.pt", nif: "210000004" },
    { name: "Miguel Tavares", phone: "+351 918 000 555", email: "miguel.tavares@exemplo.pt", nif: "210000005" },
  ].map((c) => ({ is_fleet: false, ...c, shop_id: shopId }));

  const { data: insClients, error: clientsError } = await admin.from("clients").insert(clients).select("id, name");
  if (clientsError) throw new Error("seed clients: " + clientsError.message);
  const byName = (n: string) => insClients?.find((c: any) => c.name === n)?.id;

  const vehicles = [
    { client: "Ana Marques", make: "Volkswagen", model: "Golf 1.6 TDI", year: 2018, plate: "AA-11-BB", fuel: "diesel", mileage: 148300 },
    { client: "Transportes Belém, Lda.", make: "Renault", model: "Trafic 2.0 dCi", year: 2021, plate: "AB-22-CD", fuel: "diesel", mileage: 96400 },
    { client: "Transportes Belém, Lda.", make: "Citroën", model: "Berlingo 1.5 BlueHDi", year: 2020, plate: "AC-33-DE", fuel: "diesel", mileage: 121750 },
    { client: "Rui Cardoso", make: "BMW", model: "Série 3 320d", year: 2019, plate: "AD-44-EF", fuel: "diesel", mileage: 87200 },
    { client: "Sofia Almeida", make: "Toyota", model: "Yaris 1.5 Hybrid", year: 2022, plate: "AE-55-FG", fuel: "hybrid", mileage: 34100 },
    { client: "Miguel Tavares", make: "Mercedes-Benz", model: "Classe A 180d", year: 2017, plate: "AF-66-GH", fuel: "diesel", mileage: 163900 },
  ].map((v) => ({
    shop_id: shopId, client_id: byName(v.client), make: v.make, model: v.model,
    year: v.year, plate: v.plate, fuel: v.fuel, mileage: v.mileage,
  }));

  const { data: insVehicles, error: vehiclesError } = await admin.from("vehicles").insert(vehicles).select("id, plate, client_id");
  if (vehiclesError) throw new Error("seed vehicles: " + vehiclesError.message);
  const byPlate = (p: string) => insVehicles?.find((v: any) => v.plate === p);

  await admin.from("parts").insert([
    { shop_id: shopId, name: "Filtro de óleo", reference: "OF-1042", supplier: "Bosch", internal_cost: 6.4, sale_price: 14.9, vat_rate: 23, stock_quantity: 24, min_stock: 6 },
    { shop_id: shopId, name: "Pastilhas travão dianteiras", reference: "BP-2210", supplier: "Brembo", internal_cost: 28.5, sale_price: 62, vat_rate: 23, stock_quantity: 9, min_stock: 4 },
    { shop_id: shopId, name: "Óleo 5W30 (litro)", reference: "OIL-5W30", supplier: "Castrol", internal_cost: 5.2, sale_price: 11.5, vat_rate: 23, stock_quantity: 60, min_stock: 20 },
    { shop_id: shopId, name: "Bateria 70Ah", reference: "BAT-70", supplier: "Varta", internal_cost: 71, sale_price: 129, vat_rate: 23, stock_quantity: 3, min_stock: 4 },
    { shop_id: shopId, name: "Kit distribuição", reference: "KD-8890", supplier: "Gates", internal_cost: 142, sale_price: 289, vat_rate: 23, stock_quantity: 2, min_stock: 2 },
  ]);

  const line = (desc: string, qty: number, price: number, cost: number) => ({
    description: desc, quantity: qty, unit_price: price, unit_cost: cost, vat_rate: 23, type: "part",
  });
  const labor = (hours: number, rate = 45) => ({
    description: "Mão de obra", quantity: hours, unit_price: rate, unit_cost: rate * 0.45, vat_rate: 23, type: "labor",
  });
  const totals = (lines: any[]) => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const cost = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
    const vat = subtotal * 0.23;
    return { subtotal: +subtotal.toFixed(2), vat_total: +vat.toFixed(2), total: +(subtotal + vat).toFixed(2), cost_total: +cost.toFixed(2), profit: +(subtotal - cost).toFixed(2) };
  };

  const quoteDefs = [
    { plate: "AA-11-BB", n: "ORC-0001", status: "approved", lines: [line("Filtro de óleo", 1, 14.9, 6.4), line("Óleo 5W30 (litro)", 4, 11.5, 5.2), labor(1)], days: 12 },
    { plate: "AD-44-EF", n: "ORC-0002", status: "sent", lines: [line("Pastilhas travão dianteiras", 1, 62, 28.5), labor(1.5)], days: 5 },
    { plate: "AB-22-CD", n: "ORC-0003", status: "approved", lines: [line("Kit distribuição", 1, 289, 142), labor(4)], days: 21 },
    { plate: "AE-55-FG", n: "ORC-0004", status: "draft", lines: [line("Bateria 70Ah", 1, 129, 71), labor(0.5)], days: 1 },
    { plate: "AF-66-GH", n: "ORC-0005", status: "rejected", lines: [line("Kit distribuição", 1, 289, 142), labor(5)], days: 30 },
  ];

  const quotes = quoteDefs.map((q) => {
    const v = byPlate(q.plate)!;
    return {
      shop_id: shopId, number: q.n, client_id: v.client_id, vehicle_id: v.id,
      date: daysAgo(q.days).slice(0, 10), status: q.status, lines: q.lines,
      labor_hours: q.lines.filter((l: any) => l.type === "labor").reduce((s: number, l: any) => s + l.quantity, 0),
      created_at: daysAgo(q.days), ...totals(q.lines),
    };
  });
  const { error: quotesError } = await admin.from("quotes").insert(quotes);
  if (quotesError) throw new Error("seed quotes: " + quotesError.message);

  const woDefs = [
    { plate: "AA-11-BB", n: "OS-0001", status: "delivered", tech: "Carlos Nunes", desc: "Revisão de 15.000 km", lines: [line("Filtro de óleo", 1, 14.9, 6.4), line("Óleo 5W30 (litro)", 4, 11.5, 5.2), labor(1)], days: 10 },
    { plate: "AB-22-CD", n: "OS-0002", status: "in_progress", tech: "Carlos Nunes", desc: "Substituição do kit de distribuição", lines: [line("Kit distribuição", 1, 289, 142), labor(4)], days: 2 },
    { plate: "AD-44-EF", n: "OS-0003", status: "diagnosis", tech: "Bruno Silva", desc: "Ruído na travagem a frio", lines: [labor(0.5)], days: 1 },
    { plate: "AC-33-DE", n: "OS-0004", status: "completed", tech: "Bruno Silva", desc: "Substituição de pastilhas e discos", lines: [line("Pastilhas travão dianteiras", 2, 62, 28.5), labor(2)], days: 4 },
    { plate: "AE-55-FG", n: "OS-0005", status: "open", tech: null, desc: "Bateria descarrega durante a noite", lines: [labor(0.5)], days: 0 },
  ];

  const workOrders = woDefs.map((w) => {
    const v = byPlate(w.plate)!;
    return {
      shop_id: shopId, number: w.n, client_id: v.client_id, vehicle_id: v.id,
      client_description: w.desc, technician: w.tech, status: w.status, lines: w.lines,
      labor_hours: w.lines.filter((l: any) => l.type === "labor").reduce((s: number, l: any) => s + l.quantity, 0),
      created_at: daysAgo(w.days),
      completed_at: ["completed", "delivered"].includes(w.status) ? daysAgo(Math.max(w.days - 1, 0)) : null,
      delivered_at: w.status === "delivered" ? daysAgo(Math.max(w.days - 1, 0)) : null,
      ...totals(w.lines),
    };
  });
  const { error: woError } = await admin.from("work_orders").insert(workOrders);
  if (woError) throw new Error("seed work_orders: " + woError.message);
}
