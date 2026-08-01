/**
 * enotas-cancel
 * -------------
 * Cancela uma NF já emitida no eNotas. Equivalente à nota de crédito PT
 * (NUNCA "apaga" — no Brasil o cancelamento é registado em SEFAZ).
 *
 * Body: { invoice_id: string, reason?: string }
 *
 * Idempotência: se a invoice já tem credit_note_provider_id (reutilizamos a
 * mesma coluna para consistência com o esquema PT), devolvemos os dados
 * existentes sem re-cancelar.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENOTAS_BASE = "https://api.enotasgw.com.br/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes } = await supa.auth.getUser();
    const user = userRes.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { invoice_id, reason } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id em falta" }, 400);

    const { data: inv } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id).maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) return json({ error: "Sem permissão nesta fatura" }, 403);

    if (!inv.provider_invoice_id) {
      return json({ error: "Esta nota não foi emitida no eNotas — não precisa de cancelamento fiscal." }, 400);
    }
    if (inv.credit_note_provider_id) {
      return json({
        ok: true, already_cancelled: true,
        credit_note_provider_id: inv.credit_note_provider_id,
        credit_note_number: inv.credit_note_number,
        credit_note_pdf_url: inv.credit_note_pdf_url,
      });
    }

    const { data: integ } = await admin
      .from("integracao_faturacao").select("*")
      .eq("shop_id", inv.shop_id).eq("ativo", true).maybeSingle();
    if (!integ || integ.provider !== "enotas") {
      return json({ error: "Integração eNotas não encontrada para esta oficina" }, 400);
    }

    const apiKey = await decryptSecret(integ.api_key_encrypted);
    const empresaId = String(integ.account_name).trim();
    const nfeId = String(inv.provider_invoice_id);
    const justificativa = (reason && String(reason).trim()) || "Cancelamento a pedido do cliente";

    // eNotas: cancelamento é feito com DELETE + querystring justificativa
    const url = `${ENOTAS_BASE}/empresas/${encodeURIComponent(empresaId)}/nfes/${encodeURIComponent(nfeId)}?justificativa=${encodeURIComponent(justificativa.slice(0, 250))}`;
    let delRes: Response;
    try {
      delRes = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" },
      });
    } catch (e) {
      return json({ error: `Falha de rede ao contactar eNotas: ${(e as Error).message}` }, 502);
    }
    if (!delRes.ok) {
      const txt = await delRes.text().catch(() => "");
      console.error("[enotas-cancel]", delRes.status, txt);
      return json({ error: friendlyError(delRes.status, txt) }, 400);
    }
    await delRes.text().catch(() => "");

    // Query updated document for final status/motivo
    const q = await fetch(
      `${ENOTAS_BASE}/empresas/${encodeURIComponent(empresaId)}/nfes/${encodeURIComponent(nfeId)}`,
      { headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" } },
    );
    const j = q.ok ? await q.json().catch(() => ({})) : {};

    await admin.from("invoices").update({
      status: "cancelled",
      legal_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      credit_note_provider_id: nfeId, // Reutilizamos a coluna para consistência multi-país
      credit_note_number: j?.numero ? String(j.numero) : inv.number,
      credit_note_atcud: j?.chaveAcesso || inv.atcud,
      credit_note_pdf_url: j?.linkDownloadPDF || inv.provider_pdf_url,
      credit_note_permalink: j?.linkDownloadXML || inv.provider_permalink,
    }).eq("id", invoice_id);

    return json({
      ok: true,
      credit_note_provider_id: nfeId,
      credit_note_number: j?.numero,
      credit_note_atcud: j?.chaveAcesso,
      credit_note_pdf_url: j?.linkDownloadPDF,
      credit_note_permalink: j?.linkDownloadXML,
    });
  } catch (e: any) {
    console.error("[enotas-cancel]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function friendlyError(status: number, _body: string): string {
  if (status === 401 || status === 403) return "Credenciais eNotas inválidas.";
  if (status === 404) return "NF não encontrada no eNotas.";
  if (status === 422 || status === 400) return "eNotas rejeitou o cancelamento (fora do prazo ou justificativa inválida).";
  if (status === 429) return "Limite de pedidos atingido. Tenta novamente.";
  if (status >= 500) return "Serviço eNotas indisponível.";
  return `eNotas recusou o cancelamento (HTTP ${status}).`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
