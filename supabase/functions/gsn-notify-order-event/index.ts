import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendGarageFlowPlatformEmail } from "../_shared/lovable-transactional-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LABELS: Record<string, { subject: (n: string) => string; body: (n: string, sup: string) => string }> = {
  paid: {
    subject: (n) => `Pagamento confirmado — Encomenda ${n}`,
    body: (n, sup) => `<p>O pagamento da sua encomenda <strong>${n}</strong> a <strong>${sup}</strong> foi confirmado.</p><p>O fornecedor irá preparar o envio.</p>`,
  },
  shipped: {
    subject: (n) => `Encomenda ${n} enviada`,
    body: (n, sup) => `<p>A sua encomenda <strong>${n}</strong> foi expedida por <strong>${sup}</strong>.</p>`,
  },
  delivered: {
    subject: (n) => `Encomenda ${n} entregue`,
    body: (n, sup) => `<p>A sua encomenda <strong>${n}</strong> de <strong>${sup}</strong> foi marcada como entregue.</p>`,
  },
  cancelled: {
    subject: (n) => `Encomenda ${n} cancelada`,
    body: (n, sup) => `<p>A sua encomenda <strong>${n}</strong> a <strong>${sup}</strong> foi cancelada.</p>`,
  },
};

const SUPPLIER_NEW: { subject: (n: string) => string; body: (n: string, buyer: string) => string } = {
  subject: (n) => `Nova encomenda ${n}`,
  body: (n, buyer) => `<p>Recebeu uma nova encomenda <strong>${n}</strong> de <strong>${buyer}</strong>.</p><p>Aceda ao painel para preparar o envio.</p>`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { order_id, event } = await req.json();
    if (!order_id || !event) throw new Error("order_id e event obrigatórios");

    const { data: order } = await supa
      .from("gsn_orders")
      .select("id, supplier_id, buyer_user_id, buyer_shop_id, total, currency")
      .eq("id", order_id).maybeSingle();
    if (!order) throw new Error("Encomenda não encontrada");

    const orderNumber = String(order.id).slice(0, 8).toUpperCase();

    const { data: supplier } = await supa
      .from("gsn_suppliers")
      .select("company_name, email")
      .eq("id", order.supplier_id).maybeSingle();

    const { data: buyerShop } = await supa
      .from("shops")
      .select("name")
      .eq("id", order.buyer_shop_id).maybeSingle();

    const buyerName = buyerShop?.name || "Cliente";
    const supplierName = supplier?.company_name || "Fornecedor";

    // Buyer email
    const { data: buyerUser } = await supa.auth.admin.getUserById(order.buyer_user_id);
    const buyerEmail = buyerUser?.user?.email;
    const tmpl = LABELS[event];
    const origin = req.headers.get("origin") || "https://garageflow.pt";
    const orderUrl = `${origin}/parts/orders/${order_id}`;

    const results: Record<string, unknown> = {};

    if (buyerEmail && tmpl) {
      results.buyer = await sendGarageFlowPlatformEmail({
        to: buyerEmail,
        subject: tmpl.subject(orderNumber),
        bodyHtml: tmpl.body(orderNumber, supplierName),
        cta: { label: "Ver encomenda", url: orderUrl },
        label: `gsn_order_${event}_buyer`,
        idempotencyKey: `gsn-${event}-buyer-${order_id}`,
      } as any);
    }

    // Supplier email on new paid order
    if (event === "paid" && supplier?.email) {
      results.supplier = await sendGarageFlowPlatformEmail({
        to: supplier.email,
        subject: SUPPLIER_NEW.subject(orderNumber),
        bodyHtml: SUPPLIER_NEW.body(orderNumber, buyerName),
        cta: { label: "Abrir painel", url: `${origin}/supplier/orders` },
        label: "gsn_order_paid_supplier",
        idempotencyKey: `gsn-paid-supplier-${order_id}`,
      } as any);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
