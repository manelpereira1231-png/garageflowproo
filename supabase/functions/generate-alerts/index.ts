import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const log = (step: string, details?: any) => {
  console.log(`[GENERATE-ALERTS] ${step}`, details ? JSON.stringify(details) : "");
};

// ─── Capabilities dinâmicas (plan_features) ───
// Fonte única de verdade: a matriz gerida no Super Admin.
// Nada hardcoded — qualquer plano novo criado no painel é tratado
// automaticamente com base nas features que o admin lhe atribuir.
let _featureCache: Record<string, Set<string>> | null = null;
async function loadFeatureMatrix(): Promise<Record<string, Set<string>>> {
  if (_featureCache) return _featureCache;
  const { data } = await supabaseAdmin
    .from("plan_features")
    .select("plan_slug, feature_slug, enabled");
  const map: Record<string, Set<string>> = {};
  for (const row of data || []) {
    if (!row.enabled) continue;
    (map[row.plan_slug] ??= new Set()).add(row.feature_slug);
  }
  _featureCache = map;
  return map;
}
async function hasFeature(planSlug: string, featureSlug: string): Promise<boolean> {
  const m = await loadFeatureMatrix();
  return m[planSlug]?.has(featureSlug) === true;
}

interface ShopWithSub {
  id: string;
  name: string;
  email: string;
  language: string;
  plan: string;
}

// ─── Translations ───
const translations: Record<string, Record<string, string>> = {
  pt: {
    expired_quote_title: "Orçamento expirado",
    expired_quote_msg: "O orçamento {number} para {client} expirou.",
    service_due_title: "Serviço próximo",
    service_due_msg: "O veículo {vehicle} ({plate}) tem um serviço previsto.",
    inactive_client_title: "Cliente inativo",
    inactive_client_msg: "O cliente {client} não tem atividade há mais de 90 dias.",
    warranty_title: "Garantia a expirar",
    warranty_msg: "A garantia do serviço {number} para {vehicle} expira em breve.",
    follow_up_title: "Follow-up: {title}",
    follow_up_msg: "Reenvio automático (tentativa {count}): {message}",
    revision_km_title: "Revisão por km",
    revision_km_msg: "O veículo {vehicle} ({plate}) atingiu {mileage} km. Revisão recomendada.",
    revision_months_title: "Revisão periódica",
    revision_months_msg: "O veículo {vehicle} ({plate}) não tem serviço há {months} meses.",
    email_subject: "Alerta GarageFlow: {title}",
  },
  en: {
    expired_quote_title: "Expired quote",
    expired_quote_msg: "Quote {number} for {client} has expired.",
    service_due_title: "Service due",
    service_due_msg: "Vehicle {vehicle} ({plate}) has an upcoming service.",
    inactive_client_title: "Inactive client",
    inactive_client_msg: "Client {client} has had no activity for over 90 days.",
    warranty_title: "Warranty expiring",
    warranty_msg: "Warranty for service {number} on {vehicle} is expiring soon.",
    follow_up_title: "Follow-up: {title}",
    follow_up_msg: "Auto-resend (attempt {count}): {message}",
    revision_km_title: "Mileage revision",
    revision_km_msg: "Vehicle {vehicle} ({plate}) reached {mileage} km. Revision recommended.",
    revision_months_title: "Periodic revision",
    revision_months_msg: "Vehicle {vehicle} ({plate}) has had no service for {months} months.",
    email_subject: "GarageFlow Alert: {title}",
  },
  es: {
    expired_quote_title: "Presupuesto expirado",
    expired_quote_msg: "El presupuesto {number} para {client} ha expirado.",
    service_due_title: "Servicio próximo",
    service_due_msg: "El vehículo {vehicle} ({plate}) tiene un servicio previsto.",
    inactive_client_title: "Cliente inactivo",
    inactive_client_msg: "El cliente {client} no tiene actividad desde hace más de 90 días.",
    warranty_title: "Garantía por expirar",
    warranty_msg: "La garantía del servicio {number} para {vehicle} expira pronto.",
    follow_up_title: "Seguimiento: {title}",
    follow_up_msg: "Reenvío automático (intento {count}): {message}",
    revision_km_title: "Revisión por km",
    revision_km_msg: "El vehículo {vehicle} ({plate}) alcanzó {mileage} km. Revisión recomendada.",
    revision_months_title: "Revisión periódica",
    revision_months_msg: "El vehículo {vehicle} ({plate}) no tiene servicio desde hace {months} meses.",
    email_subject: "Alerta GarageFlow: {title}",
  },
};

function tr(lang: string, key: string, vars: Record<string, string> = {}): string {
  const dict = translations[lang] || translations.pt;
  let text = dict[key] || translations.pt[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

// ─── Helpers ───
async function getShopsWithPlans(): Promise<ShopWithSub[]> {
  const { data: shops } = await supabaseAdmin
    .from("shops")
    .select("id, name, email, language")
    .eq("status", "active");

  if (!shops || shops.length === 0) return [];

  const { data: subs } = await supabaseAdmin
    .from("subscriptions")
    .select("shop_id, plan");

  const subMap = new Map<string, string>();
  (subs || []).forEach(s => subMap.set(s.shop_id, s.plan));

  return shops.map(s => ({ ...s, plan: subMap.get(s.id) || "free" }));
}

async function createAlertIfNotExists(
  shopId: string, type: string, title: string, message: string,
  dueDate: string | null, clientId: string | null, vehicleId: string | null,
  priority: string = "medium"
): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from("alerts")
    .select("id")
    .eq("shop_id", shopId)
    .eq("type", type)
    .in("status", ["pending", "sent"])
    .eq("title", title)
    .limit(1);

  if (existing && existing.length > 0) return false;

  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 3); // follow-up after 3 days

  const { error } = await supabaseAdmin.from("alerts").insert({
    shop_id: shopId, type, title, message,
    due_date: dueDate, client_id: clientId, vehicle_id: vehicleId,
    status: "pending", priority,
    next_follow_up_at: followUpDate.toISOString(),
  });

  if (error) { log("Error creating alert", { error: error.message }); return false; }
  return true;
}

async function sendAlertEmail(shopEmail: string, title: string, message: string, shopName: string) {
  if (!shopEmail) return;
  try {
    await resend.emails.send({
      from: "GarageFlow <onboarding@resend.dev>",
      to: ["manelpereira11@gmail.com"],
      subject: `[Para: ${shopEmail}] ⚠️ ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
            <h2 style="color: #92400e; font-size: 18px; margin: 0 0 8px;">${title}</h2>
            <p style="color: #78350f; font-size: 14px; margin: 0;">${message}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 12px; text-align: center;">${shopName || 'GarageFlow'}</p>
        </div>
      `,
    });
    log("Email sent", { to: shopEmail, title });
  } catch (e: any) {
    log("Email send failed", { error: e.message });
  }
}

// ─── Alert Generators ───

async function generateExpiredQuoteAlerts(shop: ShopWithSub): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data: quotes } = await supabaseAdmin
    .from("quotes")
    .select("id, number, validity_date, clients(name), client_id")
    .eq("shop_id", shop.id)
    .in("status", ["draft", "sent"])
    .lt("validity_date", today);

  if (!quotes) return 0;
  let count = 0;
  for (const q of quotes) {
    const clientName = (q.clients as any)?.name || "—";
    const title = tr(shop.language, "expired_quote_title");
    const message = tr(shop.language, "expired_quote_msg", { number: q.number, client: clientName });
    const created = await createAlertIfNotExists(shop.id, "quote_expired", title, message, q.validity_date, q.client_id, null, "high");
    if (created) {
      count++;
      if (shop.plan !== "free") await sendAlertEmail(shop.email, title, message, shop.name);
    }
  }
  return count;
}

async function generateInactiveClientAlerts(shop: ShopWithSub): Promise<number> {
  if (shop.plan !== "garage") return 0;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: clients } = await supabaseAdmin.from("clients").select("id, name").eq("shop_id", shop.id);
  if (!clients) return 0;

  let count = 0;
  for (const client of clients) {
    const { count: recentOrders } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .eq("client_id", client.id).gte("created_at", ninetyDaysAgo);
    const { count: recentQuotes } = await supabaseAdmin
      .from("quotes").select("id", { count: "exact", head: true })
      .eq("client_id", client.id).gte("created_at", ninetyDaysAgo);

    if ((recentOrders || 0) === 0 && (recentQuotes || 0) === 0) {
      const title = tr(shop.language, "inactive_client_title");
      const message = tr(shop.language, "inactive_client_msg", { client: client.name });
      const created = await createAlertIfNotExists(shop.id, "inactive_client", title, message, null, client.id, null, "low");
      if (created) { count++; await sendAlertEmail(shop.email, title, message, shop.name); }
    }
  }
  return count;
}

// Predictive: revision based on mileage (every 15000 km) and time (every 12 months)
async function generatePredictiveAlerts(shop: ShopWithSub): Promise<number> {
  if (shop.plan === "free") return 0;

  const { data: vehicles } = await supabaseAdmin
    .from("vehicles")
    .select("id, make, model, plate, mileage, client_id")
    .eq("shop_id", shop.id);

  if (!vehicles) return 0;
  let count = 0;

  for (const v of vehicles) {
    const vehicleName = `${v.make} ${v.model}`;

    // Mileage-based revision (every 15000 km)
    if (v.mileage > 0 && v.mileage % 15000 >= 13500) {
      const title = tr(shop.language, "revision_km_title");
      const message = tr(shop.language, "revision_km_msg", {
        vehicle: vehicleName, plate: v.plate, mileage: String(v.mileage)
      });
      const created = await createAlertIfNotExists(shop.id, "revision", title, message, null, v.client_id, v.id, "medium");
      if (created) { count++; await sendAlertEmail(shop.email, title, message, shop.name); }
    }

    // Time-based: no service in 6+ months
    const { data: lastService } = await supabaseAdmin
      .from("work_orders")
      .select("created_at")
      .eq("vehicle_id", v.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (lastService && lastService.length > 0) {
      const lastDate = new Date(lastService[0].created_at);
      const monthsAgo = Math.floor((Date.now() - lastDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
      if (monthsAgo >= 6) {
        const title = tr(shop.language, "revision_months_title");
        const message = tr(shop.language, "revision_months_msg", {
          vehicle: vehicleName, plate: v.plate, months: String(monthsAgo)
        });
        const priority = monthsAgo >= 12 ? "high" : "medium";
        const created = await createAlertIfNotExists(shop.id, "revision", title, message, null, v.client_id, v.id, priority);
        if (created) { count++; await sendAlertEmail(shop.email, title, message, shop.name); }
      }
    }

    // Warranty expiring: services completed within last 11-12 months (assuming 12-month warranty)
    if (shop.plan === "garage") {
      const elevenMonthsAgo = new Date(Date.now() - 11 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const twelveMonthsAgo = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: warrantySvcs } = await supabaseAdmin
        .from("work_orders")
        .select("number, completed_at")
        .eq("vehicle_id", v.id)
        .in("status", ["completed", "delivered"])
        .gte("completed_at", twelveMonthsAgo)
        .lte("completed_at", elevenMonthsAgo);

      for (const ws of (warrantySvcs || [])) {
        const title = tr(shop.language, "warranty_title");
        const message = tr(shop.language, "warranty_msg", { number: ws.number, vehicle: vehicleName });
        const created = await createAlertIfNotExists(shop.id, "warranty", title, message, null, v.client_id, v.id, "high");
        if (created) { count++; await sendAlertEmail(shop.email, title, message, shop.name); }
      }
    }
  }
  return count;
}

// Follow-up: resend pending alerts after X days (max 3 follow-ups)
async function processFollowUps(shop: ShopWithSub): Promise<number> {
  if (shop.plan === "free") return 0;

  const now = new Date().toISOString();
  const { data: dueFollowUps } = await supabaseAdmin
    .from("alerts")
    .select("id, title, message, follow_up_count, next_follow_up_at")
    .eq("shop_id", shop.id)
    .eq("status", "pending")
    .lt("next_follow_up_at", now)
    .lt("follow_up_count", 3);

  if (!dueFollowUps) return 0;
  let count = 0;

  for (const alert of dueFollowUps) {
    const newCount = (alert.follow_up_count || 0) + 1;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 3 * newCount); // increasing intervals

    await supabaseAdmin.from("alerts").update({
      follow_up_count: newCount,
      last_follow_up_at: now,
      next_follow_up_at: nextDate.toISOString(),
      status: "sent",
    }).eq("id", alert.id);

    const title = tr(shop.language, "follow_up_title", { title: alert.title });
    const message = tr(shop.language, "follow_up_msg", {
      count: String(newCount), message: alert.message
    });
    await sendAlertEmail(shop.email, title, message, shop.name);
    count++;
  }
  return count;
}

// ─── Main Handler ───
serve(async (req) => {
  // Auth guard: only the platform (cron / service role) may invoke
  const __auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    || (req.headers.get("x-internal-token") ?? "");
  if (__auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Starting alert generation");
    const shops = await getShopsWithPlans();
    log(`Found ${shops.length} active shops`);

    let totalAlerts = 0;
    for (const shop of shops) {
      if (shop.plan === "free") continue;

      let shopAlerts = 0;
      shopAlerts += await generateExpiredQuoteAlerts(shop);
      shopAlerts += await generatePredictiveAlerts(shop);

      if (shop.plan === "garage") {
        shopAlerts += await generateInactiveClientAlerts(shop);
      }

      shopAlerts += await processFollowUps(shop);

      if (shopAlerts > 0) {
        log(`Generated ${shopAlerts} alerts for shop ${shop.name}`);
      }
      totalAlerts += shopAlerts;
    }

    log(`Total alerts generated: ${totalAlerts}`);

    return new Response(
      JSON.stringify({ success: true, alerts_generated: totalAlerts }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    log("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
