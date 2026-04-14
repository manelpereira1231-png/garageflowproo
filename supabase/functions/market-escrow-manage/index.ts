import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Não autenticado");

    const { action, escrow_id, reason, response_text, resolution_notes } = await req.json();
    if (!escrow_id || !action) throw new Error("escrow_id e action são obrigatórios");

    // Get escrow
    const { data: escrow, error } = await supabaseAdmin
      .from("market_escrow")
      .select("*")
      .eq("id", escrow_id)
      .single();

    if (error || !escrow) throw new Error("Escrow não encontrado");

    // Check permissions
    const isBuyer = escrow.buyer_id === user.id;
    const isSeller = escrow.seller_id === user.id;

    // Check super admin
    const { data: isAdmin } = await supabaseAdmin.rpc("is_super_admin", { _user_id: user.id });

    switch (action) {
      // BUYER: Confirm delivery
      case "confirm_delivery": {
        if (!isBuyer) throw new Error("Apenas o comprador pode confirmar a entrega");
        if (escrow.status !== "paid") throw new Error("Escrow não está em estado 'paid'");

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "delivery_confirmed",
            delivery_confirmed_at: new Date().toISOString(),
          })
          .eq("id", escrow_id);

        return respond({ success: true, message: "Entrega confirmada. Fundos serão libertados em breve." });
      }

      // BUYER: Open dispute
      case "open_dispute": {
        if (!isBuyer) throw new Error("Apenas o comprador pode abrir disputa");
        if (!["paid"].includes(escrow.status)) throw new Error("Não é possível abrir disputa neste estado");
        if (!reason) throw new Error("Motivo da disputa é obrigatório");

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "disputed",
            buyer_dispute_reason: reason,
            disputed_at: new Date().toISOString(),
          })
          .eq("id", escrow_id);

        return respond({ success: true, message: "Disputa aberta. A equipa irá analisar." });
      }

      // SELLER: Respond to dispute
      case "respond_dispute": {
        if (!isSeller) throw new Error("Apenas o vendedor pode responder à disputa");
        if (escrow.status !== "disputed") throw new Error("Não existe disputa ativa");

        await supabaseAdmin
          .from("market_escrow")
          .update({ seller_dispute_response: response_text })
          .eq("id", escrow_id);

        return respond({ success: true, message: "Resposta registada." });
      }

      // ADMIN: Release funds to seller
      case "release_funds": {
        if (!isAdmin) throw new Error("Apenas administradores podem libertar fundos");
        if (!["delivery_confirmed", "disputed"].includes(escrow.status)) {
          throw new Error("Escrow não está em estado libertável");
        }

        // Mark listing as sold
        await supabaseAdmin
          .from("carity_listings")
          .update({ status: "sold", sold_at: new Date().toISOString() })
          .eq("id", escrow.listing_id);

        // Record transaction
        await supabaseAdmin.from("carity_transactions").insert({
          listing_id: escrow.listing_id,
          type: "sale_commission",
          amount: escrow.amount,
          platform_amount: escrow.platform_fee,
          shop_amount: 0,
          status: "completed",
          stripe_verified: true,
        });

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "released",
            released_at: new Date().toISOString(),
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
            resolution_notes: resolution_notes || "Fundos libertados pelo administrador",
          })
          .eq("id", escrow_id);

        return respond({ success: true, message: "Fundos libertados." });
      }

      // ADMIN: Refund buyer
      case "refund": {
        if (!isAdmin) throw new Error("Apenas administradores podem processar reembolsos");
        if (!["paid", "disputed"].includes(escrow.status)) {
          throw new Error("Escrow não está em estado reembolsável");
        }

        // Process Stripe refund if payment intent exists
        if (escrow.stripe_payment_intent_id) {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
            apiVersion: "2025-08-27.basil",
          });
          await stripe.refunds.create({
            payment_intent: escrow.stripe_payment_intent_id,
          });
        }

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "refunded",
            refunded_at: new Date().toISOString(),
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
            resolution_notes: resolution_notes || "Reembolso processado pelo administrador",
          })
          .eq("id", escrow_id);

        return respond({ success: true, message: "Reembolso processado." });
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}
