import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_NOTIFY = [
  "contact@garageflow.pt",
  "manelpereira11@gmail.com",
  "diogochenriques7@gmail.com",
];
const NOTIFY_TO = Array.from(new Set(
  (Deno.env.get("DEMO_NOTIFY_EMAILS")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])
    .concat(DEFAULT_NOTIFY),
));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      name, shop_name, email, phone, city,
      employees, current_software, best_contact_time, notes,
    } = body ?? {};

    if (!name || !shop_name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: "Nome, oficina, email e telefone são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const { data: inserted, error } = await admin
      .from("demo_requests")
      .insert({
        name: String(name).trim().slice(0, 150),
        shop_name: String(shop_name).trim().slice(0, 200),
        email: String(email).trim().toLowerCase().slice(0, 255),
        phone: String(phone).trim().slice(0, 50),
        city: city ? String(city).trim().slice(0, 100) : null,
        employees: employees ? String(employees).slice(0, 30) : null,
        current_software: current_software ? String(current_software).slice(0, 150) : null,
        best_contact_time: best_contact_time ? String(best_contact_time).slice(0, 100) : null,
        notes: notes ? String(notes).slice(0, 2000) : null,
        status: "new",
        source: "public_demo_page",
        ip_address: ip,
        user_agent: ua,
      })
      .select("id, created_at")
      .single();

    if (error) throw error;

    const when = new Date(inserted.created_at).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
    const subject = `🎯 Nova Demonstração Solicitada — ${shop_name}`;
    const html = `
      <h2 style="margin:0 0 12px">Nova Demonstração Solicitada</h2>
      <p>Foi recebido um novo pedido através de <strong>garageflow.pt/demo</strong>.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
        <tr><td><strong>Oficina</strong></td><td>${escape(shop_name)}</td></tr>
        <tr><td><strong>Contacto</strong></td><td>${escape(name)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escape(email)}</td></tr>
        <tr><td><strong>Telefone</strong></td><td>${escape(phone)}</td></tr>
        <tr><td><strong>Cidade</strong></td><td>${escape(city || "—")}</td></tr>
        <tr><td><strong>Colaboradores</strong></td><td>${escape(employees || "—")}</td></tr>
        <tr><td><strong>Software atual</strong></td><td>${escape(current_software || "—")}</td></tr>
        <tr><td><strong>Melhor horário</strong></td><td>${escape(best_contact_time || "—")}</td></tr>
        <tr><td><strong>Observações</strong></td><td>${escape(notes || "—")}</td></tr>
        <tr><td><strong>Data do pedido</strong></td><td>${when}</td></tr>
      </table>
      <p style="margin-top:16px">Ver e gerir em <a href="https://garageflow.pt/commercial/demos">Painel Comercial</a> ou <a href="https://garageflow.pt/admin/demos">Painel de Administração</a>.</p>
    `;

    // Fire-and-forget email via existing send-email function
    admin.functions.invoke("send-email", {
      body: {
        to: NOTIFY_TO,
        subject,
        html,
        branded: true,
        brand: "garageflow",
        preheader: `${shop_name} — ${name} (${phone})`,
      },
    }).catch((e) => console.error("send-email failed:", e));

    return new Response(
      JSON.stringify({ ok: true, id: inserted.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("submit-demo-request error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}
