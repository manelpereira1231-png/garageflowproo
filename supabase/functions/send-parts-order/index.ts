import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, shopId } = await req.json();
    if (!orderId || !shopId) {
      return new Response(JSON.stringify({ error: "Missing orderId or shopId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get order with items and supplier
    const { data: order, error: orderErr } = await supabase
      .from("parts_orders")
      .select("*, suppliers(name, contact_email, integration_active)")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order items
    const { data: items } = await supabase
      .from("parts_order_items")
      .select("*")
      .eq("order_id", orderId);

    // Get shop info
    const { data: shop } = await supabase
      .from("shops")
      .select("name, email, phone")
      .eq("id", shopId)
      .single();

    const supplier = order.suppliers as any;
    const supplierEmail = supplier?.contact_email;

    if (supplierEmail) {
      // Send email notification to supplier
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const itemsList = (items || [])
          .map((i: any) => `• ${i.part_name} (${i.part_number || "N/A"}) x${i.quantity} — €${(i.total || 0).toFixed(2)}`)
          .join("\n");

        const emailBody = `
Nova encomenda de peças recebida!

Oficina: ${shop?.name || "N/A"}
Email: ${shop?.email || "N/A"}
Telefone: ${shop?.phone || "N/A"}

Peças pedidas:
${itemsList || `• ${order.part_name} x${order.quantity} — €${(order.total || 0).toFixed(2)}`}

Total: €${(order.total || 0).toFixed(2)}

Por favor confirme a disponibilidade e prazo de entrega.
        `.trim();

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "GarageFlow <noreply@garageflow.pt>",
            to: [supplierEmail],
            subject: `Nova Encomenda de Peças — ${shop?.name || "Oficina"}`,
            text: emailBody,
          }),
        });
      }
    }

    // Update order status to sent
    await supabase
      .from("parts_orders")
      .update({ status: "sent" })
      .eq("id", orderId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});