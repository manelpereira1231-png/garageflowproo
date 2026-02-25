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

interface ShopWithSub {
  id: string;
  name: string;
  email: string;
  language: string;
  plan: string;
}

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

  return shops.map(s => ({
    ...s,
    plan: subMap.get(s.id) || "free",
  }));
}

async function createAlertIfNotExists(
  shopId: string,
  type: string,
  title: string,
  message: string,
  dueDate: string | null,
  clientId: string | null,
  vehicleId: string | null
): Promise<boolean> {
  // Check if similar alert already exists and is pending/sent
  const { data: existing } = await supabaseAdmin
    .from("alerts")
    .select("id")
    .eq("shop_id", shopId)
    .eq("type", type)
    .in("status", ["pending", "sent"])
    .eq("title", title)
    .limit(1);

  if (existing && existing.length > 0) return false;

  const { error } = await supabaseAdmin.from("alerts").insert({
    shop_id: shopId,
    type,
    title,
    message,
    due_date: dueDate,
    client_id: clientId,
    vehicle_id: vehicleId,
    status: "pending",
  });

  if (error) {
    log("Error creating alert", { error: error.message });
    return false;
  }
  return true;
}

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

async function sendAlertEmail(shopEmail: string, title: string, message: string, shopName: string) {
  if (!shopEmail) return;
  try {
    await resend.emails.send({
      from: `GarageFlow <noreply@resend.dev>`,
      to: [shopEmail],
      subject: `⚠️ ${title}`,
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

async function generateExpiredQuoteAlerts(shop: ShopWithSub) {
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
    const created = await createAlertIfNotExists(shop.id, "expired_quote", title, message, q.validity_date, q.client_id, null);
    if (created) {
      count++;
      if (shop.plan !== "free") {
        await sendAlertEmail(shop.email, title, message, shop.name);
      }
    }
  }
  return count;
}

async function generateInactiveClientAlerts(shop: ShopWithSub) {
  if (shop.plan !== "garage") return 0;
  
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("shop_id", shop.id);

  if (!clients) return 0;
  let count = 0;
  for (const client of clients) {
    const { count: recentOrders } = await supabaseAdmin
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", ninetyDaysAgo);

    const { count: recentQuotes } = await supabaseAdmin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", ninetyDaysAgo);

    if ((recentOrders || 0) === 0 && (recentQuotes || 0) === 0) {
      const title = tr(shop.language, "inactive_client_title");
      const message = tr(shop.language, "inactive_client_msg", { client: client.name });
      const created = await createAlertIfNotExists(shop.id, "inactive_client", title, message, null, client.id, null);
      if (created) {
        count++;
        await sendAlertEmail(shop.email, title, message, shop.name);
      }
    }
  }
  return count;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Starting alert generation");
    const shops = await getShopsWithPlans();
    log(`Found ${shops.length} active shops`);

    let totalAlerts = 0;
    for (const shop of shops) {
      if (shop.plan === "free") continue; // Skip free plans

      let shopAlerts = 0;
      shopAlerts += await generateExpiredQuoteAlerts(shop);

      if (shop.plan === "garage") {
        shopAlerts += await generateInactiveClientAlerts(shop);
      }

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