/**
 * platform-billing
 * ----------------
 * Faturação GARAGEFLOW → OFICINA (subscrições SaaS).
 *
 * NÃO confundir com a faturação OFICINA → CLIENTE (invoicexpress-emit,
 * moloni-emit, enotas-emit) — essa continua intocada.
 *
 * Estado inicial: PREPARADO / NÃO ATIVO. Nenhum documento fiscal é emitido
 * enquanto `platform_billing_settings.fiscal_billing_active` for false e a
 * configuração fiscal (entidade legal + NIF + InvoiceXpress) não estiver
 * completa e validada.
 *
 * Todas as ações exigem super admin (verificado em código com o JWT).
 *
 * Ações:
 *   status          → definições (sem chaves), contadores, checklist, marco 20 oficinas
 *   save_settings   → grava dados fiscais / config InvoiceXpress (chave cifrada)
 *   test_ix         → testa credenciais InvoiceXpress do GarageFlow
 *   activate        → liga a emissão fiscal (só se checklist obrigatório completo)
 *   deactivate      → desliga a emissão fiscal
 *   sync_stripe     → importa cobranças Stripe pagas para platform_invoices (idempotente)
 *   emit            → emite documento fiscal de UMA cobrança (idempotente)
 *   resend_email    → reenvia o email da fatura já emitida (não re-emite)
 */
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret, decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function logEvent(
  invoiceId: string | null,
  event_type: string,
  level: "info" | "warn" | "error",
  message: string,
  payload?: unknown,
) {
  await admin.from("platform_invoice_events").insert({
    platform_invoice_id: invoiceId,
    event_type,
    level,
    message: message.slice(0, 2000),
    payload: payload ?? null,
  });
}

/** Requisitos obrigatórios antes de qualquer emissão fiscal. */
function computeChecklist(s: any, payingShops: number) {
  const manual = (s?.checklist ?? {}) as Record<string, boolean>;
  return {
    // automáticos (derivados do estado real)
    paying_shops: payingShops >= (s?.paying_shops_target ?? 20),
    legal_name: !!s?.legal_name,
    tax_id: !!s?.tax_id,
    legal_address: !!(s?.address && s?.postal_code && s?.city && s?.country),
    vat_regime: !!s?.vat_regime,
    ix_configured: !!(s?.ix_account_name && s?.ix_api_key_encrypted),
    ix_connection_ok: s?.ix_connection_ok === true,
    series: !!s?.ix_sequence_id,
    // manuais (confirmados pelo administrador)
    company_incorporated: manual.company_incorporated === true,
    test_issue_done: manual.test_issue_done === true,
    email_validated: manual.email_validated === true,
    stripe_flow_tested: manual.stripe_flow_tested === true,
    accounting_validated: manual.accounting_validated === true,
  };
}

/** Requisitos que bloqueiam a ativação. */
const REQUIRED_FOR_ACTIVATION = [
  "legal_name", "tax_id", "legal_address", "vat_regime",
  "ix_configured", "ix_connection_ok", "series",
  "company_incorporated", "test_issue_done", "accounting_validated",
];

async function countPayingShops(): Promise<number> {
  const { data } = await admin
    .from("subscriptions")
    .select("shop_id, status, revenue_type, stripe_subscription_id, shops!inner(is_demo)")
    .in("status", ["active", "past_due"]);
  const rows = (data ?? []) as any[];
  const ids = new Set(
    rows
      .filter((r) => r.shops?.is_demo !== true)
      .filter((r) => r.revenue_type === "stripe_paid" || !!r.stripe_subscription_id)
      .map((r) => r.shop_id),
  );
  return ids.size;
}

async function getSettings() {
  const { data } = await admin.from("platform_billing_settings").select("*").limit(1).maybeSingle();
  return data;
}

function publicSettings(s: any) {
  if (!s) return null;
  const { ix_api_key_encrypted, ...rest } = s;
  return { ...rest, ix_api_key_set: !!ix_api_key_encrypted };
}

const IX_KIND: Record<string, { endpoint: string; bodyKey: string }> = {
  invoice: { endpoint: "invoices", bodyKey: "invoice" },
  invoice_receipt: { endpoint: "invoice_receipts", bodyKey: "invoice_receipt" },
  simplified_invoice: { endpoint: "simplified_invoices", bodyKey: "simplified_invoice" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("is_super_admin", { _user_id: user.id });
    if (isAdmin !== true) return json({ error: "Apenas o super administrador" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");

    // ─────────────────────────── STATUS ───────────────────────────
    if (action === "status") {
      const s = await getSettings();
      const payingShops = await countPayingShops();
      const checklist = computeChecklist(s, payingShops);
      const blocking = REQUIRED_FOR_ACTIVATION.filter((k) => !(checklist as any)[k]);
      return json({
        ok: true,
        settings: publicSettings(s),
        paying_shops: payingShops,
        target: s?.paying_shops_target ?? 20,
        milestone_reached: payingShops >= (s?.paying_shops_target ?? 20),
        checklist,
        blocking,
        ready_to_activate: blocking.length === 0,
        fiscal_billing_active: s?.fiscal_billing_active === true,
      });
    }

    // ──────────────────────── SAVE SETTINGS ───────────────────────
    if (action === "save_settings") {
      const s = await getSettings();
      const p = body.settings ?? {};
      const patch: Record<string, unknown> = {};
      for (
        const k of [
          "legal_name", "tax_id", "address", "postal_code", "city", "country",
          "vat_regime", "vat_rate", "ix_account_name", "ix_document_type",
          "ix_sequence_id", "paying_shops_target", "notes", "checklist",
        ]
      ) {
        if (p[k] !== undefined) patch[k] = p[k];
      }
      if (typeof p.ix_api_key === "string" && p.ix_api_key.trim() !== "") {
        patch.ix_api_key_encrypted = await encryptSecret(p.ix_api_key.trim());
        patch.ix_connection_ok = false; // exige novo teste
      }
      // Alterar credenciais/dados fiscais nunca ativa a faturação sozinha.
      const { error } = await admin.from("platform_billing_settings").update(patch).eq("id", s.id);
      if (error) return json({ error: error.message }, 400);
      await logEvent(null, "settings_saved", "info", `Definições fiscais atualizadas por ${user.email}`, {
        fields: Object.keys(patch),
      });
      const fresh = await getSettings();
      return json({ ok: true, settings: publicSettings(fresh) });
    }

    // ───────────────────────── TEST INVOICEXPRESS ─────────────────
    if (action === "test_ix") {
      const s = await getSettings();
      if (!s?.ix_account_name || !s?.ix_api_key_encrypted) {
        return json({ ok: false, error: "Conta e chave InvoiceXpress do GarageFlow em falta." }, 400);
      }
      const apiKey = await decryptSecret(s.ix_api_key_encrypted);
      const base = `https://${s.ix_account_name}.app.invoicexpress.com`;
      let ok = false;
      let errMsg: string | null = null;
      try {
        const r = await fetch(`${base}/sequences.json?api_key=${encodeURIComponent(apiKey)}`, {
          headers: { Accept: "application/json" },
        });
        ok = r.ok;
        if (!ok) errMsg = `HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`;
      } catch (e) {
        errMsg = (e as Error).message;
      }
      await admin.from("platform_billing_settings").update({
        ix_connection_ok: ok,
        ix_last_check_at: new Date().toISOString(),
        ix_last_error: errMsg,
      }).eq("id", s.id);
      await logEvent(null, "ix_test", ok ? "info" : "error", ok ? "Ligação InvoiceXpress OK" : `Falha: ${errMsg}`);
      return json({ ok, error: errMsg });
    }

    // ───────────────────────── ACTIVATE / DEACTIVATE ──────────────
    if (action === "activate" || action === "deactivate") {
      const s = await getSettings();
      if (action === "activate") {
        const payingShops = await countPayingShops();
        const checklist = computeChecklist(s, payingShops);
        const blocking = REQUIRED_FOR_ACTIVATION.filter((k) => !(checklist as any)[k]);
        if (blocking.length > 0) {
          return json({ ok: false, error: "Requisitos em falta", blocking }, 400);
        }
      }
      await admin.from("platform_billing_settings").update({
        fiscal_billing_active: action === "activate",
        activated_at: action === "activate" ? new Date().toISOString() : null,
        activated_by: action === "activate" ? user.id : null,
      }).eq("id", s.id);
      await logEvent(null, action, "info", `Faturação fiscal do GarageFlow ${action === "activate" ? "ATIVADA" : "desativada"} por ${user.email}`);
      return json({ ok: true });
    }

    // ───────────────────────── SYNC STRIPE ────────────────────────
    // Importa cobranças pagas do Stripe para platform_invoices.
    // Idempotente: stripe_invoice_id é único.
    if (action === "sync_stripe") {
      const key = Deno.env.get("STRIPE_SECRET_KEY");
      if (!key) return json({ ok: false, error: "STRIPE_SECRET_KEY não configurada" }, 400);
      const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
      const settings = await getSettings();

      let imported = 0, skipped = 0;
      const list = await stripe.invoices.list({ limit: 100, status: "paid" });
      for (const inv of list.data) {
        if (!inv.id) continue;
        const { data: exists } = await admin
          .from("platform_invoices").select("id").eq("stripe_invoice_id", inv.id).maybeSingle();
        if (exists) { skipped++; continue; }

        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
        let sub: any = null;
        if (customerId) {
          const { data } = await admin
            .from("subscriptions")
            .select("id, shop_id, plan, billing_cycle")
            .eq("stripe_customer_id", customerId).maybeSingle();
          sub = data;
        }
        const total = (inv.total ?? 0) / 100;
        const tax = (inv.tax ?? 0) / 100;
        const net = total - tax;
        const line = inv.lines?.data?.[0];
        await admin.from("platform_invoices").insert({
          shop_id: sub?.shop_id ?? null,
          subscription_id: sub?.id ?? null,
          plan: sub?.plan ?? null,
          billing_cycle: sub?.billing_cycle ?? null,
          period_start: line?.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
          period_end: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
          currency: (inv.currency || "eur").toUpperCase(),
          amount_net: net,
          vat_rate: tax > 0 && net > 0 ? Math.round((tax / net) * 100) : 0,
          vat_amount: tax,
          amount_total: total,
          stripe_invoice_id: inv.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: typeof inv.subscription === "string" ? inv.subscription : null,
          stripe_status: inv.status ?? null,
          stripe_hosted_url: inv.hosted_invoice_url ?? null,
          paid_at: inv.status_transitions?.paid_at
            ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
            : null,
          fiscal_status: settings?.fiscal_billing_active ? "queued" : "pending_config",
        });
        imported++;
      }
      await logEvent(null, "sync_stripe", "info", `Sincronização Stripe: ${imported} novas, ${skipped} já existentes`);
      return json({ ok: true, imported, skipped });
    }

    // ───────────────────────────── EMIT ───────────────────────────
    if (action === "emit") {
      const id = String(body.platform_invoice_id || "");
      if (!id) return json({ error: "platform_invoice_id em falta" }, 400);

      const s = await getSettings();
      if (s?.fiscal_billing_active !== true) {
        return json({
          ok: false,
          error: "A faturação fiscal do GarageFlow ainda não está ativa. Conclui a configuração legal/fiscal primeiro.",
          code: "fiscal_inactive",
        }, 409);
      }

      const { data: pi } = await admin.from("platform_invoices").select("*").eq("id", id).maybeSingle();
      if (!pi) return json({ error: "Registo não encontrado" }, 404);

      // IDEMPOTÊNCIA — nunca emitir duas vezes para o mesmo pagamento.
      if (pi.provider_invoice_id || pi.fiscal_status === "issued") {
        return json({
          ok: true, already_issued: true,
          provider_number: pi.provider_number, pdf_url: pi.provider_pdf_url,
        });
      }

      const apiKey = await decryptSecret(s.ix_api_key_encrypted);
      const base = `https://${s.ix_account_name}.app.invoicexpress.com`;
      const kind = IX_KIND[s.ix_document_type] || IX_KIND.invoice_receipt;

      const { data: shop } = pi.shop_id
        ? await admin.from("shops").select("name, nif, address, postal_code, city, country, email").eq("id", pi.shop_id).maybeSingle()
        : { data: null as any };

      const payload: any = {
        [kind.bodyKey]: {
          date: new Date().toISOString().slice(0, 10),
          due_date: new Date().toISOString().slice(0, 10),
          reference: pi.stripe_invoice_id ?? pi.id,
          observations: `Subscrição GarageFlow — plano ${pi.plan ?? "-"}${
            pi.period_start ? ` (${String(pi.period_start).slice(0, 10)} a ${String(pi.period_end).slice(0, 10)})` : ""
          }`,
          client: {
            name: (shop?.name || "Cliente").slice(0, 254),
            code: (pi.shop_id || pi.id).slice(0, 30),
            email: shop?.email || undefined,
            address: shop?.address || undefined,
            postal_code: shop?.postal_code || undefined,
            city: shop?.city || undefined,
            fiscal_id: shop?.nif || "999999990",
          },
          items: [{
            name: `Subscrição GarageFlow — ${pi.plan ?? "plano"}`,
            unit_price: Number(pi.amount_net || 0),
            quantity: 1,
            tax: { name: `IVA ${Number(s.vat_rate ?? 23)}%` },
          }],
          ...(s.ix_sequence_id ? { sequence_id: s.ix_sequence_id } : {}),
        },
      };

      const fail = async (msg: string) => {
        await admin.from("platform_invoices").update({
          fiscal_status: "error",
          last_error: msg.slice(0, 1000),
          attempts: (pi.attempts ?? 0) + 1,
        }).eq("id", id);
        await logEvent(id, "emit_failed", "error", msg);
        return json({ ok: false, error: msg }, 400);
      };

      const createRes = await fetch(`${base}/${kind.endpoint}.json?api_key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) {
        return await fail(`InvoiceXpress (criar) HTTP ${createRes.status}: ${(await createRes.text().catch(() => "")).slice(0, 300)}`);
      }
      const created = await createRes.json();
      const doc = created?.[kind.bodyKey] || created;
      const providerId = String(doc?.id ?? "");
      if (!providerId) return await fail("InvoiceXpress não devolveu o ID do documento");

      const finalizeRes = await fetch(
        `${base}/${kind.endpoint}/${providerId}/change-state.json?api_key=${encodeURIComponent(apiKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ [kind.bodyKey]: { state: "finalized" } }),
        },
      );
      if (!finalizeRes.ok) {
        return await fail(`InvoiceXpress (finalizar) HTTP ${finalizeRes.status}: ${(await finalizeRes.text().catch(() => "")).slice(0, 300)}`);
      }

      const getRes = await fetch(`${base}/${kind.endpoint}/${providerId}.json?api_key=${encodeURIComponent(apiKey)}`, {
        headers: { Accept: "application/json" },
      });
      const finalJson = await getRes.json().catch(() => ({}));
      const finalDoc = finalJson?.[kind.bodyKey] || finalJson;
      const number = finalDoc?.inverted_sequence_number || finalDoc?.sequence_number || null;
      const pdfUrl = finalDoc?.public_pdf_url || finalDoc?.pdf_url || null;

      await admin.from("platform_invoices").update({
        fiscal_status: "issued",
        provider: "invoicexpress",
        provider_invoice_id: providerId,
        provider_number: number,
        provider_series: number ? String(number).split("/")[0] : null,
        provider_pdf_url: pdfUrl,
        issued_at: new Date().toISOString(),
        last_error: null,
        attempts: (pi.attempts ?? 0) + 1,
      }).eq("id", id);
      await logEvent(id, "issued", "info", `Documento emitido: ${number ?? providerId}`);

      // Email (falha no email NUNCA re-emite documento)
      if (shop?.email) {
        const r = await sendInvoiceEmail(id, shop.email, number, pdfUrl, pi);
        if (!r.ok) await logEvent(id, "email_failed", "warn", r.error ?? "falha no email");
      }

      return json({ ok: true, provider_number: number, pdf_url: pdfUrl });
    }

    // ─────────────────────── RESEND EMAIL ─────────────────────────
    if (action === "resend_email") {
      const id = String(body.platform_invoice_id || "");
      const { data: pi } = await admin.from("platform_invoices").select("*").eq("id", id).maybeSingle();
      if (!pi) return json({ error: "Registo não encontrado" }, 404);
      if (pi.fiscal_status !== "issued") {
        return json({ ok: false, error: "Só é possível reenviar faturas já emitidas." }, 400);
      }
      const { data: shop } = await admin.from("shops").select("email").eq("id", pi.shop_id).maybeSingle();
      if (!shop?.email) return json({ ok: false, error: "A oficina não tem email registado." }, 400);
      const r = await sendInvoiceEmail(id, shop.email, pi.provider_number, pi.provider_pdf_url, pi);
      return json(r);
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[platform-billing]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function sendInvoiceEmail(
  id: string,
  to: string,
  number: string | null,
  pdfUrl: string | null,
  pi: any,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const html = `
      <p>Olá,</p>
      <p>Segue a fatura da tua subscrição GarageFlow.</p>
      <ul>
        <li><strong>Documento:</strong> ${number ?? "-"}</li>
        <li><strong>Plano:</strong> ${pi.plan ?? "-"}</li>
        <li><strong>Valor sem IVA:</strong> ${Number(pi.amount_net || 0).toFixed(2)} ${pi.currency}</li>
        <li><strong>IVA:</strong> ${Number(pi.vat_amount || 0).toFixed(2)} ${pi.currency}</li>
        <li><strong>Total:</strong> ${Number(pi.amount_total || 0).toFixed(2)} ${pi.currency}</li>
      </ul>
      ${pdfUrl ? `<p><a href="${pdfUrl}">Descarregar fatura (PDF)</a></p>` : ""}
      <p>Podes consultar as tuas faturas em GarageFlow → Subscrição → Faturas.</p>`;
    const { error } = await admin.functions.invoke("send-email", {
      body: {
        to,
        subject: `Fatura GarageFlow ${number ?? ""}`.trim(),
        html,
        branded: true,
      },
      headers: { "x-internal-token": Deno.env.get("INTERNAL_EMAIL_TOKEN") ?? "" },
    });
    if (error) throw new Error(error.message);
    await admin.from("platform_invoices").update({
      email_status: "sent",
      email_sent_at: new Date().toISOString(),
      email_error: null,
    }).eq("id", id);
    await logEvent(id, "email_sent", "info", `Email enviado para ${to}`);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from("platform_invoices").update({
      email_status: "failed",
      email_error: msg.slice(0, 500),
    }).eq("id", id);
    return { ok: false, error: msg };
  }
}
