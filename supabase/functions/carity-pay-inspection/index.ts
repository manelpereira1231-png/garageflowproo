import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Utilizador não autenticado");

    const body = await req.json();
    const { listing_id, type, action } = body;
    if (!listing_id && !action) throw new Error("listing_id é obrigatório");

    // Handle car purchase action (via accepted offer)
    if (action === "buy_car") {
      const { offer_id, amount } = body;
      if (!offer_id || !amount || !listing_id) throw new Error("Dados de compra inválidos");

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Verify the offer exists and is accepted
      const { data: offer, error: offerErr } = await adminClient
        .from("carity_offers")
        .select("*")
        .eq("id", offer_id)
        .eq("buyer_id", user.id)
        .eq("status", "accepted")
        .single();

      if (offerErr || !offer) throw new Error("Proposta não encontrada ou já processada");

      // Get listing info
      const { data: listing } = await adminClient
        .from("carity_listings")
        .select("*")
        .eq("id", listing_id)
        .single();

      if (!listing) throw new Error("Anúncio não encontrado");

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      const origin = req.headers.get("origin") || "https://garageflow.pt";
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string | undefined;
      if (customers.data.length > 0) customerId = customers.data[0].id;

      // 2% commission
      const amountCents = Math.round(amount * 100);
      const commissionCents = Math.round(amountCents * 0.02);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `${listing.make} ${listing.model} (${listing.year})`,
              description: `Compra via GarageFlow Market — Matrícula: ${listing.plate}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/market/car/${listing_id}?purchase=success`,
        cancel_url: `${origin}/market/car/${listing_id}?purchase=cancelled`,
        metadata: {
          listing_id,
          offer_id,
          type: "carity_car_purchase",
          commission_cents: String(commissionCents),
          buyer_id: user.id,
          seller_id: listing.seller_id,
        },
      });

      // Update offer with stripe session
      await adminClient.from("carity_offers")
        .update({ stripe_session_id: session.id, status: "payment_pending" })
        .eq("id", offer_id);

      // Record transaction
      await adminClient.from("carity_transactions").insert({
        listing_id,
        type: "car_purchase",
        amount,
        platform_amount: commissionCents / 100,
        shop_amount: 0,
        status: "pending",
        stripe_payment_id: session.id,
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle direct Buy Now (at full listed price, no offer needed)
    if (action === "buy_now") {
      if (!listing_id) throw new Error("listing_id é obrigatório");

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: listing } = await adminClient
        .from("carity_listings")
        .select("*")
        .eq("id", listing_id)
        .eq("status", "published")
        .single();

      if (!listing) throw new Error("Anúncio não encontrado ou já vendido");
      if (listing.seller_id === user.id) throw new Error("Não pode comprar o seu próprio carro");

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      const origin = req.headers.get("origin") || "https://garageflow.pt";
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string | undefined;
      if (customers.data.length > 0) customerId = customers.data[0].id;

      const amountCents = Math.round(listing.price * 100);
      const commissionCents = Math.round(amountCents * 0.02);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `${listing.make} ${listing.model} (${listing.year})`,
              description: `Compra direta via GarageFlow Market — Matrícula: ${listing.plate}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/market/car/${listing_id}?purchase=success`,
        cancel_url: `${origin}/market/car/${listing_id}?purchase=cancelled`,
        metadata: {
          listing_id,
          type: "carity_car_purchase_direct",
          commission_cents: String(commissionCents),
          buyer_id: user.id,
          seller_id: listing.seller_id,
        },
      });

      // Record transaction
      await adminClient.from("carity_transactions").insert({
        listing_id,
        type: "car_purchase",
        amount: listing.price,
        platform_amount: commissionCents / 100,
        shop_amount: 0,
        status: "pending",
        stripe_payment_id: session.id,
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!listing_id) throw new Error("listing_id é obrigatório");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://garageflow.pt";

    // Check/create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Handle boost payments
    if (type === "boost") {
      const { boost_type } = body;
      const boostPrices: Record<string, { amount: number; label: string; days: number }> = {
        "7d": { amount: 599, label: "Destaque 7 dias", days: 7 },
        "14d": { amount: 999, label: "Destaque 14 dias", days: 14 },
        "top": { amount: 1299, label: "Topo do marketplace", days: 30 },
      };

      const boost = boostPrices[boost_type || "7d"];
      if (!boost) throw new Error("Tipo de boost inválido");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: `Carity — ${boost.label}` },
            unit_amount: boost.amount,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/carity/meus-anuncios?boost=success`,
        cancel_url: `${origin}/carity/meus-anuncios?boost=cancelled`,
        metadata: { listing_id, type: "carity_boost", boost_type: boost_type || "7d" },
      });

      await adminClient.from("carity_boosts").insert({
        listing_id,
        seller_id: user.id,
        boost_type: boost_type || "7d",
        price: boost.amount / 100,
        status: "pending",
        stripe_session_id: session.id,
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle inspection payment (default)
    const { data: listing, error: listingErr } = await adminClient
      .from("carity_listings")
      .select("*")
      .eq("id", listing_id)
      .eq("seller_id", user.id)
      .eq("status", "pending_payment")
      .single();

    if (listingErr || !listing) throw new Error("Anúncio não encontrado ou já pago");

    // Inspection: 24.90€
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Inspeção Carity — ${listing.make} ${listing.model} (${listing.year})`,
            description: `Inspeção técnica oficial para ${listing.plate}`,
          },
          unit_amount: 2490,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/carity/meus-anuncios?payment=success`,
      cancel_url: `${origin}/carity/pagar/${listing_id}?payment=cancelled`,
      metadata: { listing_id, type: "carity_inspection" },
    });

    // Update listing status
    await adminClient.from("carity_listings")
      .update({ status: "pending_inspection" })
      .eq("id", listing_id);

    // ── AUTO-ASSIGN: Find partner shops and send inspection offers ──

    // Get seller location from profile
    const { data: sellerProfile } = await adminClient
      .from("carity_seller_profiles")
      .select("location")
      .eq("user_id", user.id)
      .single();

    // Get all active partner shops
    const { data: partnerShops } = await adminClient
      .from("shops")
      .select("id, name, email, phone, address, latitude, longitude")
      .eq("is_carity_partner", true)
      .eq("carity_active", true);

    if (partnerShops && partnerShops.length > 0) {
      // Sort by distance if seller has coords, otherwise take all
      let sortedShops = [...partnerShops];

      // Try to find a shop with coordinates to calculate distance
      const shopsWithCoords = sortedShops.filter(s => s.latitude && s.longitude);

      if (shopsWithCoords.length > 0) {
        // Use the first shop with coords as reference or seller location
        // For now, sort shops with coords first (nearest logic ready for when seller has coords)
        sortedShops = [
          ...shopsWithCoords,
          ...sortedShops.filter(s => !s.latitude || !s.longitude),
        ];
      }

      // Take top 5 shops
      const topShops = sortedShops.slice(0, 5);

      // Create inspection record assigned to nearest shop
      const primaryShop = topShops[0];
      const { data: inspection } = await adminClient
        .from("carity_inspections")
        .insert({
          listing_id,
          shop_id: primaryShop.id,
          status: "pending",
          payment_status: "paid",
          payment_amount: 24.90,
          shop_share: 16.19,
          platform_share: 8.72,
          stripe_session_id: session.id,
          notes: `Inspeção auto-atribuída após pagamento. ${listing.make} ${listing.model} (${listing.year}) - ${listing.plate}`,
        })
        .select()
        .single();

      if (inspection) {
        // Create offers for all top shops
        const offers = topShops.map(shop => ({
          inspection_id: inspection.id,
          listing_id,
          shop_id: shop.id,
          status: "pending",
        }));

        await adminClient.from("carity_inspection_offers").insert(offers);

        // Create notification for each shop
        const notifications = topShops.map(shop => ({
          shop_id: shop.id,
          title: "🚗 Nova inspeção Market disponível",
          message: `Novo pedido de inspeção: ${listing.make} ${listing.model} (${listing.year}) - ${listing.plate}. Aceite antes que outra oficina o faça!`,
          type: "carity_inspection",
          link: "/market/inspections",
        }));

        await adminClient.from("notifications").insert(notifications);

        // Try to send push notifications (non-blocking)
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          for (const shop of topShops) {
            await fetch(`${supabaseUrl}/functions/v1/send-push`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                shop_id: shop.id,
                title: "🚗 Nova inspeção Market",
                body: `${listing.make} ${listing.model} (${listing.year}) - Aceite agora!`,
                url: "/market/inspections",
              }),
            }).catch(() => {});
          }
        } catch (_) {
          // Push is non-blocking
        }
      }

      // Update listing with the primary shop
      await adminClient.from("carity_listings")
        .update({ shop_id: primaryShop.id })
        .eq("id", listing_id);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("carity-pay-inspection error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
