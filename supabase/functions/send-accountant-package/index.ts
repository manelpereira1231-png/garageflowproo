/**
 * send-accountant-package
 *
 * Envia ao contabilista da plataforma o pacote completo do período:
 *  - CSV de movimentos
 *  - Relatório HTML/PDF imprimível
 *  - SAF-T PT (subset informativo)
 *
 * Só super_admin pode invocar. O destinatário é lido de platform_company_info.accountant_email
 * (nunca é aceite via body, para evitar uso como open-relay).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  date_from: string;
  date_to: string;
  csv_base64: string;
  saft_base64: string;
  report_html_base64: string;
  totals: { subs: number; market: number; total: number };
  message?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: super_admin only
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — super_admin only" }, 403);

    const body = await req.json() as Body;
    if (!body?.date_from || !body?.date_to || !body?.csv_base64 || !body?.saft_base64 || !body?.report_html_base64) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Fetch accountant + company info (server-side, source of truth)
    const { data: info } = await admin
      .from("platform_company_info")
      .select("*")
      .limit(1)
      .maybeSingle();

    const accountantEmail = (info?.accountant_email || "").trim();
    if (!accountantEmail || !accountantEmail.includes("@")) {
      return json({ error: "Email do contabilista não configurado em Dados fiscais" }, 400);
    }

    const legalName = info?.legal_name || "GarageFlow";
    const nif = info?.tax_id || "—";
    const totals = body.totals || { subs: 0, market: 0, total: 0 };

    const subject = `[${legalName}] Pacote contabilístico ${body.date_from} → ${body.date_to}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
        <h2 style="color:#0f172a;margin:0 0 8px">Pacote contabilístico — ${escapeHtml(legalName)}</h2>
        <p style="color:#64748b;margin:0 0 20px;font-size:13px">NIF ${escapeHtml(nif)} · Período <strong>${body.date_from}</strong> a <strong>${body.date_to}</strong></p>

        <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:12px 14px;font-size:12px;color:#7c2d12;margin:16px 0;border-radius:4px">
          <strong>Aviso legal:</strong> GarageFlow não é software de faturação certificado pela AT.
          Os ficheiros anexos (CSV, PDF, SAF-T XML) são informativos e destinam-se a apoiar
          o trabalho do contabilista, que emitirá / certificará os documentos oficiais no
          seu próprio sistema certificado.
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">Receita subscrições Stripe</td>
              <td style="padding:8px 0;text-align:right;font-weight:600">€${totals.subs.toFixed(2)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Comissões Marketplace</td>
              <td style="padding:8px 0;text-align:right;font-weight:600">€${totals.market.toFixed(2)}</td></tr>
          <tr style="border-top:1px solid #e2e8f0">
              <td style="padding:12px 0;font-weight:700">Total período</td>
              <td style="padding:12px 0;text-align:right;font-weight:700;color:#0f172a;font-size:16px">€${totals.total.toFixed(2)}</td></tr>
        </table>

        <p style="font-size:13px;line-height:1.6">Em anexo:</p>
        <ul style="font-size:13px;line-height:1.7;color:#334155">
          <li><strong>movimentos.csv</strong> — lista completa de subscrições e comissões</li>
          <li><strong>relatorio.html</strong> — relatório imprimível (abrir e Ctrl+P → PDF)</li>
          <li><strong>SAFT.xml</strong> — SAF-T PT subset "Faturação" (informativo)</li>
        </ul>

        ${body.message ? `<div style="margin-top:20px;padding:12px;background:#f8fafc;border-radius:6px;font-size:13px;white-space:pre-wrap">${escapeHtml(body.message)}</div>` : ""}

        <p style="color:#94a3b8;font-size:11px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px">
          Enviado automaticamente por ${escapeHtml(legalName)} em ${new Date().toLocaleString("pt-PT")}.
        </p>
      </div>
    `;

    const filenameBase = `${legalName.replace(/\s+/g, "_")}_${body.date_from}_${body.date_to}`;

    const { data, error } = await resend.emails.send({
      from: "GarageFlow Contabilidade <noreply@garageflow.pt>",
      to: [accountantEmail],
      subject,
      html,
      attachments: [
        { filename: `${filenameBase}_movimentos.csv`, content: body.csv_base64 },
        { filename: `${filenameBase}_relatorio.html`, content: body.report_html_base64 },
        { filename: `${filenameBase}_SAFT.xml`, content: body.saft_base64 },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return json({ error: error.message || "Erro ao enviar" }, 500);
    }

    // Audit log
    try {
      await admin.from("audit_logs").insert({
        user_id: userData.user.id,
        action: "accountant_package_sent",
        entity_type: "platform_company_info",
        entity_id: info?.id ?? null,
        details: {
          accountant_email: accountantEmail,
          date_from: body.date_from,
          date_to: body.date_to,
          totals,
        },
      });
    } catch (_e) { /* ignore */ }

    return json({ success: true, sent_to: accountantEmail, email_id: (data as any)?.id });
  } catch (e: any) {
    console.error("send-accountant-package error:", e);
    return json({ error: e?.message || "Erro" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
function escapeHtml(s: string) {
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));
}
