import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = "manelpereira11@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  ticket_id?: string;
  contact_name?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  context: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const p: Payload = await req.json();
    if (!p.contact_email || !p.subject || !p.message) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const platform = p.context === "market" ? "GarageFlow Market" : "GarageFlow ERP";
    const priorityColor =
      p.priority === "urgent" ? "#dc2626" : p.priority === "high" ? "#ea580c" : "#0f172a";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;">
        <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
          <div style="border-left:4px solid ${priorityColor};padding-left:16px;margin-bottom:20px;">
            <h1 style="margin:0;font-size:20px;color:#0f172a;">📩 Novo Pedido de Suporte</h1>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;">${platform} • Prioridade: <strong style="color:${priorityColor};text-transform:uppercase;">${p.priority}</strong> • Categoria: ${p.category}</p>
          </div>

          <h2 style="font-size:17px;color:#0f172a;margin:0 0 8px;">${p.subject}</h2>
          <div style="background:#f1f5f9;border-radius:8px;padding:14px;margin:12px 0;white-space:pre-wrap;color:#1e293b;font-size:14px;line-height:1.5;">${p.message.replace(/</g, "&lt;")}</div>

          <table style="width:100%;font-size:13px;color:#334155;margin-top:16px;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#64748b;width:120px;">Nome</td><td>${p.contact_name || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Email</td><td><a href="mailto:${p.contact_email}" style="color:#2563eb;">${p.contact_email}</a></td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Telefone</td><td>${p.contact_phone || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">ID Ticket</td><td style="font-family:monospace;font-size:11px;color:#94a3b8;">${p.ticket_id || "—"}</td></tr>
          </table>

          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
            <a href="https://garageflow.pt/admin/support" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Ver no Painel Admin →</a>
          </div>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">GarageFlow Support System</p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: "GarageFlow Support <noreply@garageflow.pt>",
      to: [ADMIN_EMAIL],
      reply_to: p.contact_email,
      subject: `[${platform}] [${p.priority.toUpperCase()}] ${p.subject}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("notify-support-ticket error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
