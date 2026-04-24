import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const {
      name, email, phone, company, city, password,
      country_code, payout_method,
      payout_holder_name, payout_iban, payout_mbway_phone, payout_bank,
    } = body;
    const cleanCountry = (country_code || "PT").toString().toUpperCase().slice(0, 4);

    // Validate required fields
    if (!name?.trim() || !email?.trim()) {
      return new Response(JSON.stringify({ error: "Nome e email são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Password deve ter pelo menos 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone?.trim() || "";

    // Anti-fraud: Check duplicate by email in partners
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

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        is_affiliate: true,
      },
    });

    if (authError) {
      // Check if user already exists in auth
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        return new Response(JSON.stringify({ error: "Este email já tem uma conta. Faça login." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Erro ao criar conta. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // 2. Generate unique affiliate code: AF-XXXXX
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

    // 3. Create the partner record linked to auth user
    const { data: partner, error: insertError } = await supabase.from("partners").insert({
      name: name.trim(),
      contact_email: cleanEmail,
      contact_phone: cleanPhone,
      type: "affiliate",
      commission_percentage: 10,
      discount_percentage: 0,
      country_code: cleanCountry,
      payout_method: payout_method || "bank_transfer",
      payout_holder_name: payout_holder_name?.trim() || "",
      payout_iban: payout_iban?.trim() || "",
      payout_mbway_phone: payout_mbway_phone?.trim() || "",
      payout_bank: payout_bank?.trim() || "",
      status: "active",
      api_key: affiliateCode,
      auth_user_id: userId,
    }).select().single();

    if (insertError) {
      console.error("Insert error:", insertError);
      // Clean up auth user if partner creation fails
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao criar afiliado. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Log the registration
    await supabase.from("partner_logs").insert({
      partner_id: partner.id,
      action: "affiliate_self_registered",
      details: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        company: company?.trim() || null,
        city: city?.trim() || null,
        country_code: cleanCountry,
        affiliate_code: affiliateCode,
        payout_method: payout_method || "bank_transfer",
        source: "public_signup",
        auth_user_id: userId,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
      },
    });

    // 5. Sign in to get session tokens for auto-login
    // Use the admin API to generate a link which gives us access tokens
    const supabaseAnonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: signInData, error: signInError } = await supabaseAnonClient.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    return new Response(JSON.stringify({
      id: partner.id,
      code: affiliateCode,
      session: signInData?.session ? {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      } : null,
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
