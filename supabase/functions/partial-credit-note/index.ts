/**
 * partial-credit-note
 * -------------------
 * Nota de crédito PARCIAL (linhas / quantidades escolhidas) ligada à fatura original.
 * - A fatura original NUNCA é alterada nem apagada.
 * - InvoiceXpress: emissão real via /api/credit_notes.json (mesma API da NC total).
 * - Moloni / eNotas: não suportado nesta versão → recusado com mensagem clara.
 * - Fatura sem emissão certificada: registo interno (sem valor fiscal), claramente identificado.
 * Body: { invoice_id, reason, notes?, lines: [{ item_id, quantity }] }
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const r2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userRes } = await supa.auth.getUser();
    const user = userRes.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { invoice_id, reason, notes, lines } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id em falta" }, 400);
    if (!reason || !String(reason).trim()) return json({ error: "Motivo obrigatório" }, 400);
    if (!Array.isArray(lines) || lines.length === 0) return json({ error: "Escolha pelo menos uma linha" }, 400);

    const { data: inv } = await admin.from("invoices").select("*, invoice_items(*), clients(*)").eq("id", invoice_id).maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) return json({ error: "Sem permissão nesta fatura" }, 403);
    if (inv.status === "draft" || inv.status === "cancelled" || inv.legal_status === "cancelled") {
      return json({ error: "Só é possível creditar faturas emitidas e não anuladas" }, 400);
    }

    // Quantidades já creditadas por linha
    const { data: prev } = await admin.from("credit_notes").select("lines").eq("invoice_id", invoice_id).in("status", ["issued", "internal"]);
    const credited: Record<string, number> = {};
    for (const p of prev || []) for (const l of (p.lines as any[]) || []) credited[l.item_id] = (credited[l.item_id] || 0) + Number(l.quantity || 0);

    const items: any[] = inv.invoice_items || [];
    const out: any[] = [];
    for (const l of lines) {
      const it = items.find((i) => i.id === l.item_id);
      const q = Number(l.quantity);
      if (!it) return json({ error: "Linha inválida" }, 400);
      if (!(q > 0)) continue;
      const avail = r2(Number(it.quantity) - (credited[it.id] || 0));
      if (q > avail + 1e-9) return json({ error: `Quantidade acima do disponível em "${it.description}" (máx. ${avail})` }, 400);
      const sub = r2(q * Number(it.unit_price));
      const vat = r2(sub * Number(it.vat_rate || 0) / 100);
      out.push({ item_id: it.id, description: it.description, quantity: q, unit_price: Number(it.unit_price), vat_rate: Number(it.vat_rate || 0), subtotal: sub, vat, total: r2(sub + vat) });
    }
    if (out.length === 0) return json({ error: "Escolha pelo menos uma quantidade" }, 400);
    const subtotal = r2(out.reduce((s, l) => s + l.subtotal, 0));
    const vat_amount = r2(out.reduce((s, l) => s + l.vat, 0));
    const total = r2(subtotal + vat_amount);

    const base = { shop_id: inv.shop_id, invoice_id, kind: "partial", lines: out, subtotal, vat_amount, total, reason: String(reason).slice(0, 250), notes: notes ? String(notes).slice(0, 1000) : null, created_by: user.id };

    // Sem emissão certificada → registo interno
    if (!inv.provider_invoice_id) {
      const { data: row, error } = await admin.from("credit_notes").insert({ ...base, status: "internal", provider: null, issued_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      return json({ ok: true, credit_note: row });
    }

    const { data: integ } = await admin.from("integracao_faturacao").select("*").eq("shop_id", inv.shop_id).eq("ativo", true).maybeSingle();
    if (!integ || integ.provider !== "invoicexpress") {
      return json({ error: `Nota de crédito parcial ainda não disponível para ${integ?.provider === "moloni" ? "Moloni" : integ?.provider === "enotas" ? "eNotas" : "este programa de faturação"}. Use a nota de crédito total ou emita a parcial no próprio programa.` }, 400);
    }

    const { data: row, error: insErr } = await admin.from("credit_notes").insert({ ...base, status: "pending", provider: "invoicexpress" }).select().single();
    if (insErr) throw insErr;
    const fail = async (msg: string) => {
      await admin.from("credit_notes").update({ status: "error", error_message: msg }).eq("id", row.id);
      return json({ error: msg, credit_note_id: row.id }, 400);
    };

    const apiKey = await decryptSecret(integ.api_key_encrypted);
    const ixBase = `https://${integ.account_name}.app.invoicexpress.com`;
    const client = inv.clients || {};
    const taxId = client.nif && String(client.nif).trim() ? String(client.nif).trim() : "999999990";
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      credit_note: {
        date: today, due_date: today,
        reference: `Crédito parcial ${inv.number}`,
        observations: [base.reason, base.notes].filter(Boolean).join(" — ").slice(0, 250),
        client: { name: (client.company || client.name || "Consumidor Final").slice(0, 254), code: (client.id || "").slice(0, 30), email: client.email || undefined, fiscal_id: taxId },
        items: out.map((l) => ({ name: (l.description || "Serviço").slice(0, 150), unit_price: l.unit_price, quantity: l.quantity, tax: { name: `IVA ${l.vat_rate}%` } })),
        owner_invoice_id: inv.provider_invoice_id,
        manual_related_document: "true",
        related_documents: [{ related_document: { document_type: "Invoice", document_id: inv.provider_invoice_id } }],
      },
    };
    const cr = await fetch(`${ixBase}/api/credit_notes.json?api_key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    if (!cr.ok) return await fail(`InvoiceXpress recusou a nota de crédito (HTTP ${cr.status}).`);
    const created = await cr.json();
    const cnId = String((created?.credit_note || created)?.id ?? "");
    if (!cnId) return await fail("InvoiceXpress não devolveu o ID da nota de crédito.");
    const fin = await fetch(`${ixBase}/api/credit_notes/${cnId}/change-state.json?api_key=${encodeURIComponent(apiKey)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credit_note: { state: "finalized", message: base.reason } }) });
    if (!fin.ok) {
      await admin.from("credit_notes").update({ provider_id: cnId }).eq("id", row.id);
      return await fail(`Nota criada no InvoiceXpress mas não finalizada (HTTP ${fin.status}). Finalize-a no InvoiceXpress.`);
    }
    const g = await fetch(`${ixBase}/api/credit_notes/${cnId}.json?api_key=${encodeURIComponent(apiKey)}`, { headers: { Accept: "application/json" } });
    const j = await g.json().catch(() => ({}));
    const cn = j?.credit_note || j;
    const { data: done } = await admin.from("credit_notes").update({
      status: "issued", provider_id: cnId, issued_at: new Date().toISOString(),
      number: cn?.inverted_sequence_number || cn?.sequence_number || null, atcud: cn?.atcud || null,
      pdf_url: cn?.public_pdf_url || cn?.pdf_url || null, permalink: cn?.permalink || null,
    }).eq("id", row.id).select().single();
    return json({ ok: true, credit_note: done });
  } catch (e: any) {
    console.error("[partial-credit-note]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
