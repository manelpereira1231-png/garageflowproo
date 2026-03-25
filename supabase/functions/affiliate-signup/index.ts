import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const body = await req.json();
    const { name, email, phone, company, city, payout_method, payout_holder_name, payout_iban, payout_mbway_phone, payout_bank } = body;

    // Validate required fields
    if (!name?.trim() || !email?.trim()) {
      return new Response(JSON.stringify({ error: "Nome e email são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone?.trim() || "";

    // Anti-fraud: Check duplicate by email
    const { data: existingEmail } = await supabase
      .from("partners")
      .select("id")
      .eq("contact_email", cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      return new Response(JSON.stringify({ error: "Já existe um afiliado registado com este email." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-fraud: Check duplicate by phone (if provided)
    if (cleanPhone && cleanPhone.length > 5) {
      const { data: existingPhone } = await supabase
        .from("partners")
        .select("id")
        .eq("contact_phone", cleanPhone)
        .maybeSingle();

      if (existingPhone) {
        return new Response(JSON.stringify({ error: "Já existe um afiliado registado com este telefone." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate unique affiliate code: AF-XXXXX (5 random alphanumeric)
    let affiliateCode = "";
    let codeExists = true;
    while (codeExists) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "AF-";
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      affiliateCode = code;

      const { data: codeCheck } = await supabase
        .from("partners")
        .select("id")
        .eq("api_key", affiliateCode)
        .maybeSingle();
      codeExists = !!codeCheck;
    }

    // Create the affiliate with payment data
    const { data: partner, error: insertError } = await supabase.from("partners").insert({
      name: name.trim(),
      contact_email: cleanEmail,
      contact_phone: cleanPhone,
      type: "affiliate",
      commission_percentage: 10,
      discount_percentage: 0,
      payout_method: payout_method || "bank_transfer",
      payout_holder_name: payout_holder_name?.trim() || "",
      payout_iban: payout_iban?.trim() || "",
      payout_mbway_phone: payout_mbway_phone?.trim() || "",
      payout_bank: payout_bank?.trim() || "",
      status: "active",
      api_key: affiliateCode,
    }).select().single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao criar afiliado. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the registration
    await supabase.from("partner_logs").insert({
      partner_id: partner.id,
      action: "affiliate_self_registered",
      details: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        company: company?.trim() || null,
        city: city?.trim() || null,
        affiliate_code: affiliateCode,
        payout_method: payout_method || "bank_transfer",
        source: "public_signup",
        ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
      },
    });

    return new Response(JSON.stringify({
      id: partner.id,
      code: affiliateCode,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Affiliate signup error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
