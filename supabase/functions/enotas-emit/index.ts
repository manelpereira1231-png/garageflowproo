/**
 * enotas-emit
 * -----------
 * Emite UMA nota fiscal (NFS-e por defeito) no eNotas a partir de uma invoice
 * do GarageFlow (draft). O eNotas é o emissor certificado — gera número, série,
 * chave de acesso, PDF/DANFE e XML. O GarageFlow apenas envia os dados e
 * armazena a referência devolvida.
 *
 * Body: { invoice_id: string, send_email?: boolean }
 *
 * Idempotência:
 *  - `idExterno` = invoice.id → o eNotas nunca emite duas notas para o mesmo
 *    idExterno; se a invoice já tem provider_invoice_id devolvemos o cached.
 *
 * Retries & status:
 *  - Emissão é assíncrona no eNotas: fazemos POST → consultamos até 5x com
 *    backoff exponencial curto até `status === "Autorizada"` (ou terminal).
 *  - Estado final é gravado em invoices.legal_status ("certified" |
 *    "processing" | "rejected"), com PDF/XML persistidos quando disponíveis.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const bodyIn = await req.json();
    const { invoice_id, send_email = false, action } = bodyIn ?? {};

    // ─── Action: get_pdf ────────────────────────────────────────────────
    if (action === "get_pdf") {
      const lookupId = bodyIn.id || bodyIn.provider_invoice_id || invoice_id;
      if (!lookupId) return json({ error: "id em falta" }, 400);
      const { data: inv } = await admin
        .from("invoices")
        .select("shop_id, provider_pdf_url")
        .or(`provider_invoice_id.eq.${lookupId},id.eq.${lookupId}`)
        .maybeSingle();
      if (!inv) return json({ error: "Documento não encontrado" }, 404);
      const { data: idsA } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
      const shopIdsA = Array.isArray(idsA) ? idsA.map((r: any) => r.get_user_shop_ids ?? r) : [];
      if (!shopIdsA.includes(inv.shop_id)) return json({ error: "Sem permissão" }, 403);
      return json({ pdf_url: inv.provider_pdf_url || null });
    }

    if (!invoice_id) return json({ error: "invoice_id em falta" }, 400);

    // Load invoice with items + client + shop
    const { data: inv } = await admin
      .from("invoices")
      .select("*, invoice_items(*), clients(*), shops(*)")
      .eq("id", invoice_id).maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    // Ownership check
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) return json({ error: "Sem permissão nesta fatura" }, 403);

    const { data: canEmit, error: capErr } = await supa.rpc("has_capability", {
      _shop_id: inv.shop_id, _cap: "invoices.create",
    });
    if (capErr || canEmit !== true) return json({ error: "Sem permissão para emitir notas fiscais" }, 403);

    // Idempotência
    if (inv.provider_invoice_id) {
      return json({
        ok: true, already_emitted: true,
        provider_invoice_id: inv.provider_invoice_id,
        chave_acesso: inv.atcud,
        number: inv.number,
        pdf_url: inv.provider_pdf_url,
        permalink: inv.provider_permalink,
      });
    }

    // Load integration
    const { data: integ } = await admin
      .from("integracao_faturacao").select("*")
      .eq("shop_id", inv.shop_id).eq("ativo", true).maybeSingle();
    if (!integ) {
      return json({ error: "Esta oficina ainda não tem integração eNotas configurada. Vai a Definições → Faturação Fiscal." }, 400);
    }
    if (integ.provider !== "enotas") {
      return json({ error: `Provider '${integ.provider}' não é suportado por esta função (usa a função correspondente).` }, 400);
    }

    const apiKey = await decryptSecret(integ.api_key_encrypted);
    const empresaId = String(integ.account_name).trim();
    const kind = (integ.documento_default || "nfse").toLowerCase(); // nfse | nfe | nfce

    const client = inv.clients || {};
    const clientDoc = String(client.nif || "").replace(/\D/g, "");
    const tipoPessoa = clientDoc.length > 11 ? "J" : "F";

    // Build eNotas payload
    // eNotas unifica os documentos brasileiros num único endpoint /nfes
    // — o campo `tipo` indica qual (NFS-e / NF-e / NFC-e).
    const tipoMap: Record<string, string> = { nfse: "NFS-e", nfe: "NF-e", nfce: "NFC-e" };
    const totalValue = Number(inv.total ?? inv.subtotal ?? 0);
    const descricaoServico = (inv.invoice_items || [])
      .map((it: any) =>
        `${Number(it.quantity || 1)}x ${String(it.description || "Serviço").trim()} — R$ ${Number(it.unit_price || 0).toFixed(2)}`)
      .join("\n")
      .slice(0, 1900) || "Serviços prestados pela oficina";

    const payload: Record<string, unknown> = {
      tipo: tipoMap[kind] || "NFS-e",
      idExterno: String(inv.id),
      ambienteEmissao: "Producao",
      enviarPorEmail: !!send_email && !!client.email,
      cliente: {
        tipoPessoa,
        nome: String(client.company || client.name || "Consumidor").slice(0, 150),
        email: client.email || undefined,
        cpfCnpj: clientDoc || undefined,
        telefone: client.phone || undefined,
        endereco: client.address ? {
          logradouro: String(client.address).slice(0, 120),
          cep: (client.postal_code || "").replace(/\D/g, "") || undefined,
          municipio: client.city || undefined,
          uf: client.state || undefined,
        } : undefined,
      },
      servico: {
        descricao: descricaoServico,
        aliquotaIss: Number(integ.serie_default) || undefined, // opcional: aliquota configurada
        issRetidoFonte: false,
      },
      valorTotal: Number(totalValue.toFixed(2)),
      observacoes: (inv.notes || `Fatura ${inv.number} — GarageFlow`).slice(0, 490),
    };

    // 1) Emit (POST)
    const emitRes = await fetchWithRetry(
      `${ENOTAS_BASE}/empresas/${encodeURIComponent(empresaId)}/nfes`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!emitRes.ok) {
      const txt = await emitRes.text().catch(() => "");
      const msg = `eNotas (emit) HTTP ${emitRes.status}: ${txt.slice(0, 300)}`;
      console.error("[enotas-emit]", msg);
      await admin.from("integracao_faturacao")
        .update({ last_error: msg }).eq("shop_id", inv.shop_id);
      return json({ error: friendlyError(emitRes.status, txt) }, 400);
    }
    const emitJson = await emitRes.json().catch(() => ({} as any));
    // eNotas devolve { nfeId: "..." } no POST inicial
    const nfeId: string | undefined = emitJson?.nfeId || emitJson?.id;
    if (!nfeId) {
      console.error("[enotas-emit] Resposta sem nfeId:", JSON.stringify(emitJson).slice(0, 400));
      return json({ error: "eNotas não devolveu ID do documento" }, 502);
    }

    // 2) Poll status (até 5x, backoff exponencial curto)
    let finalDoc: any = null;
    let lastStatus = "Processando";
    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(700 * Math.pow(1.6, attempt)); // 700, 1120, 1792, 2867, 4587ms
      const q = await fetchWithRetry(
        `${ENOTAS_BASE}/empresas/${encodeURIComponent(empresaId)}/nfes/${encodeURIComponent(nfeId)}`,
        { method: "GET", headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" } },
      );
      if (!q.ok) { await q.text().catch(() => ""); continue; }
      const j = await q.json().catch(() => ({}));
      finalDoc = j;
      lastStatus = String(j?.status ?? "Processando");
      if (["Autorizada", "Cancelada", "Negada", "Denegada", "Rejeitada"].includes(lastStatus)) break;
    }

    const chaveAcesso: string | undefined = finalDoc?.chaveAcesso;
    const numero: string | undefined = finalDoc?.numero ? String(finalDoc.numero) : undefined;
    const serie: string | undefined = finalDoc?.serie ? String(finalDoc.serie) : undefined;
    const pdfUrl: string | undefined = finalDoc?.linkDownloadPDF || finalDoc?.linkDownload;
    const xmlUrl: string | undefined = finalDoc?.linkDownloadXML;

    const legalStatus =
      lastStatus === "Autorizada" ? "certified" :
      ["Negada", "Denegada", "Rejeitada"].includes(lastStatus) ? "rejected" :
      "processing";

    // 3) Persist references — arquitetura existente (mesmas colunas que PT).
    await admin.from("invoices").update({
      status: legalStatus === "certified" ? "issued" : inv.status,
      legal_status: legalStatus,
      provider: "enotas",
      provider_invoice_id: nfeId,
      atcud: chaveAcesso || null,       // Chave de acesso (44 dígitos) — equivalente semântico do ATCUD para BR
      certified_series: serie || null,
      provider_pdf_url: pdfUrl || null,
      provider_permalink: xmlUrl || null, // XML: usamos permalink para o link do XML
      emitida_em: legalStatus === "certified" ? new Date().toISOString() : null,
      number: numero || inv.number,
    }).eq("id", invoice_id);

    if (legalStatus !== "certified") {
      const motivo = finalDoc?.motivoStatus || `Estado: ${lastStatus}`;
      await admin.from("integracao_faturacao")
        .update({ last_error: `NF ${nfeId}: ${motivo}` }).eq("shop_id", inv.shop_id);
    }

    return json({
      ok: true,
      provider_invoice_id: nfeId,
      status: lastStatus,
      legal_status: legalStatus,
      number: numero,
      serie,
      chave_acesso: chaveAcesso,
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
      motivo: finalDoc?.motivoStatus,
    });
  } catch (e: any) {
    console.error("[enotas-emit]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(url, init);
      // Retry on 429 and 5xx
      if (r.status === 429 || r.status >= 500) {
        if (i < maxAttempts - 1) { await r.text().catch(() => ""); await sleep(500 * (i + 1) * (i + 1)); continue; }
      }
      return r;
    } catch (e) {
      lastErr = e;
      await sleep(500 * (i + 1) * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha de rede ao contactar eNotas");
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function friendlyError(status: number, _body: string): string {
  if (status === 401 || status === 403) return "Credenciais eNotas inválidas. Reconfigura em Definições → Faturação Fiscal.";
  if (status === 422 || status === 400) return "eNotas rejeitou os dados da nota. Confirma CPF/CNPJ do cliente e dados do serviço.";
  if (status === 429) return "Limite de pedidos eNotas atingido. Tenta novamente em instantes.";
  if (status >= 500) return "Serviço eNotas indisponível. Tenta novamente.";
  return `eNotas recusou o pedido (HTTP ${status}).`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
