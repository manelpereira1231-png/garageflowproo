// Generates a sale contract once escrow is paid.
// Called by the client after detecting status === 'paid'. Idempotent: returns the existing contract if any.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const escrow_id: string | undefined = body.escrow_id;
    if (!escrow_id || typeof escrow_id !== "string") {
      return new Response(JSON.stringify({ error: "escrow_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load escrow + ensure user is a party
    const { data: escrow, error: escrowErr } = await admin
      .from("market_escrow")
      .select("*")
      .eq("id", escrow_id)
      .maybeSingle();

    if (escrowErr || !escrow) {
      return new Response(JSON.stringify({ error: "Escrow não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.id !== escrow.buyer_id && user.id !== escrow.seller_id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["paid", "delivery_confirmed", "released"].includes(escrow.status)) {
      return new Response(JSON.stringify({ error: "Contrato disponível apenas após pagamento" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: if a contract already exists, return it
    const { data: existing } = await admin
      .from("market_contracts")
      .select("*")
      .eq("escrow_id", escrow_id)
      .maybeSingle();

    if (existing) {
      // Enrich with current parties data
      const enriched = await enrichContract(admin, existing, escrow);
      return new Response(JSON.stringify({ contract: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Load listing + parties
    const [{ data: listing }, { data: sellerProfile }] = await Promise.all([
      admin.from("carity_listings").select("*").eq("id", escrow.listing_id).maybeSingle(),
      admin.from("carity_seller_profiles").select("*").eq("user_id", escrow.seller_id).maybeSingle(),
    ]);

    const { data: buyerAuth } = await admin.auth.admin.getUserById(escrow.buyer_id);
    const buyerMeta = (buyerAuth?.user?.user_metadata as Record<string, unknown>) ?? {};

    const buyer_snapshot = {
      name: (buyerMeta.full_name as string) || (buyerMeta.name as string) || buyerAuth?.user?.email?.split("@")[0] || "Comprador",
      email: buyerAuth?.user?.email ?? "",
      nif: (buyerMeta.nif as string) ?? null,
      phone: (buyerMeta.phone as string) ?? null,
      address: (buyerMeta.address as string) ?? null,
    };

    const seller_snapshot = {
      name: sellerProfile?.name || "Vendedor",
      nif: sellerProfile?.nif ?? null,
      phone: sellerProfile?.phone ?? null,
      address: sellerProfile?.address || sellerProfile?.location || null,
      location: sellerProfile?.location ?? null,
      document_type: sellerProfile?.document_type ?? null,
      document_number: sellerProfile?.document_number ?? null,
    };

    const vehicle_snapshot = {
      make: listing?.make,
      model: listing?.model,
      year: listing?.year,
      mileage: listing?.mileage,
      fuel: listing?.fuel,
      plate: listing?.plate,
      vin: listing?.vin,
    };

    // Generate sequential-ish contract number
    const today = new Date();
    const contract_number = `GFM-${today.getFullYear()}-${escrow_id.slice(0, 8).toUpperCase()}`;

    const payloadForHash = {
      escrow_id,
      listing_id: escrow.listing_id,
      buyer_id: escrow.buyer_id,
      seller_id: escrow.seller_id,
      amount: Number(escrow.amount),
      vehicle_snapshot,
      buyer_snapshot,
      seller_snapshot,
      created_at: today.toISOString(),
    };
    const contract_hash = await sha256(JSON.stringify(payloadForHash, Object.keys(payloadForHash).sort()));

    const { data: created, error: insertErr } = await admin
      .from("market_contracts")
      .insert({
        escrow_id,
        listing_id: escrow.listing_id,
        buyer_id: escrow.buyer_id,
        seller_id: escrow.seller_id,
        amount: escrow.amount,
        contract_number,
        contract_hash,
        vehicle_snapshot,
        buyer_snapshot,
        seller_snapshot,
        signed_status: "pending",
      })
      .select("*")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ contract: { ...created, listing } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function enrichContract(admin: any, contract: Record<string, unknown>, _escrow: Record<string, unknown>) {
  const { data: listing } = await admin
    .from("carity_listings")
    .select("*")
    .eq("id", contract.listing_id as string)
    .maybeSingle();
  return { ...contract, listing };
}
