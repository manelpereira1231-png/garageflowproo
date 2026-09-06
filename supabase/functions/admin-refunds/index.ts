/**
 * admin-refunds
 * -------------
 * Reembolsos das subscrições GarageFlow (pagamentos Stripe registados em
 * `platform_invoices`), 100% operáveis a partir do Admin.
 *
 * Usa a integração Stripe existente (STRIPE_SECRET_KEY). Não cria uma segunda
 * integração paralela e nunca expõe credenciais.
 *
 * Ações:
 *   detail  → detalhe do pagamento + reembolsos + valor disponível
 *   refund  → cria o reembolso REAL no Stripe (validado + idempotente)
 *   sync    → reconcilia o pagamento com o Stripe (não cria nada)
 *
 * Regras absolutas:
 *  - só super admin (validado no backend com o JWT);
 *  - nunca marcar como reembolsado sem confirmação do Stripe;
 *  - idempotência por chave estável → duplo clique nunca gera dois refunds;
 *  - oferta / plano manual / demo nunca são reembolsáveis (não há pagamento).
 */
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const toCents = (n: number) => Math.round((Number(n) || 0) * 100);

const SUPPORTED_CURRENCIES = ["EUR", "BRL", "USD", "GBP", "INR"];

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
    message: String(message).slice(0, 2000),
    payload: payload ?? null,
  }).then(() => {}, () => {});
}

async function auditLog(userId: string, action: string, entityId: string, details: Record<string, unknown>) {
  await admin.from("audit_logs").insert({
    action, entity_type: "platform_refund", entity_id: entityId, user_id: userId, details,
  }).then(() => {}, () => {});
}

/** Resolve o charge Stripe do pagamento (guarda em cache na fatura). */
async function resolveCharge(stripe: Stripe, inv: any): Promise<{ chargeId: string | null; piId: string | null; error?: string }> {
  if (inv.stripe_charge_id) {
    return { chargeId: inv.stripe_charge_id, piId: inv.stripe_payment_intent_id ?? null };
  }
  try {
    if (inv.stripe_invoice_id) {
      const si = await stripe.invoices.retrieve(inv.stripe_invoice_id, { expand: ["payments"] } as any) as any;
      let chargeId: string | null = typeof si.charge === "string" ? si.charge : si.charge?.id ?? null;
      let piId: string | null = typeof si.payment_intent === "string" ? si.payment_intent : si.payment_intent?.id ?? null;

      // Stripe Basil: a cobrança vive em invoice.payments[].payment.payment_intent
      if (!chargeId && !piId) {
        const p = si.payments?.data?.[0]?.payment;
        piId = typeof p?.payment_intent === "string" ? p.payment_intent : p?.payment_intent?.id ?? null;
        chargeId = typeof p?.charge === "string" ? p.charge : p?.charge?.id ?? null;
      }
      if (!chargeId && piId) {
        const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
        const lc = (pi as any).latest_charge;
        chargeId = typeof lc === "string" ? lc : lc?.id ?? null;
      }
      if (chargeId || piId) {
        await admin.from("platform_invoices")
          .update({ stripe_charge_id: chargeId, stripe_payment_intent_id: piId })
          .eq("id", inv.id);
      }
      return { chargeId, piId };
    }
    if (inv.stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(inv.stripe_payment_intent_id, { expand: ["latest_charge"] });
      const lc = (pi as any).latest_charge;
      const chargeId = typeof lc === "string" ? lc : lc?.id ?? null;
      if (chargeId) await admin.from("platform_invoices").update({ stripe_charge_id: chargeId }).eq("id", inv.id);
      return { chargeId, piId: inv.stripe_payment_intent_id };
    }
  } catch (e) {
    return { chargeId: null, piId: null, error: (e as Error).message };
  }
  return { chargeId: null, piId: null, error: "Pagamento sem referência Stripe" };
}

function mapRefundStatus(s: string | null | undefined): "succeeded" | "processing" | "failed" | "canceled" {
  switch (s) {
    case "succeeded": return "succeeded";
    case "failed": return "failed";
    case "canceled": return "canceled";
    default: return "processing"; // pending / requires_action
  }
}

/** Espelha os refunds do Stripe deste charge na BD (idempotente). */
async function mirrorStripeRefunds(stripe: Stripe, inv: any, chargeId: string, actorId: string | null) {
  const list = await stripe.refunds.list({ charge: chargeId, limit: 100 });
  for (const r of list.data) {
    const status = mapRefundStatus(r.status);
    const { data: existing } = await admin
      .from("platform_refunds").select("id").eq("stripe_refund_id", r.id).maybeSingle();
    const row = {
      platform_invoice_id: inv.id,
      shop_id: inv.shop_id,
      amount: round2((r.amount ?? 0) / 100),
      currency: String(r.currency || inv.currency || "eur").toUpperCase(),
      status,
      raw_status: r.status ?? null,
      reason: r.reason ?? null,
      stripe_refund_id: r.id,
      stripe_charge_id: chargeId,
      stripe_payment_intent_id: typeof r.payment_intent === "string" ? r.payment_intent : null,
      confirmed_at: status === "succeeded" ? new Date((r.created ?? 0) * 1000).toISOString() : null,
    };
    if (existing) {
      await admin.from("platform_refunds").update(row).eq("id", existing.id);
    } else {
      await admin.from("platform_refunds").insert({
        ...row,
        idempotency_key: `stripe:${r.id}`,
        requested_by: actorId,
        notes: "Importado do Stripe (sincronização)",
      });
    }
  }
  return list.data.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ───────── Autorização (backend, nunca só no UI) ─────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const { data: userRes } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userRes?.user;
    if (!user) return json({ error: "Não autorizado" }, 401);
    const { data: isAdmin } = await admin.rpc("is_super_admin", { _user_id: user.id });
    if (isAdmin !== true) return json({ error: "Apenas o super administrador pode reembolsar" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "detail");
    const invoiceId = String(body.platform_invoice_id || "");
    if (!invoiceId) return json({ error: "Pagamento não indicado" }, 400);

    const { data: inv } = await admin.from("platform_invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!inv) return json({ error: "Pagamento não encontrado" }, 404);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

    const loadState = async () => {
      const { data: refunds } = await admin
        .from("platform_refunds").select("*").eq("platform_invoice_id", invoiceId)
        .order("created_at", { ascending: false });
      const { data: fresh } = await admin.from("platform_invoices").select("*").eq("id", invoiceId).maybeSingle();
      const paid = round2(Number(fresh?.amount_total) || 0);
      const refunded = round2(Number(fresh?.amount_refunded) || 0);
      let shop: any = null;
      if (fresh?.shop_id) {
        const { data } = await admin.from("shops").select("id, name, nif, email, country, is_demo").eq("id", fresh.shop_id).maybeSingle();
        shop = data;
      }
      return {
        invoice: fresh, shop, refunds: refunds ?? [],
        paid, refunded, available: round2(Math.max(paid - refunded, 0)),
        refundable: paid > 0 && !!fresh?.paid_at && shop?.is_demo !== true,
      };
    };

    // ───────────────────────── DETAIL ─────────────────────────
    if (action === "detail") return json({ ok: true, ...(await loadState()) });

    // ────────────────────────── SYNC ──────────────────────────
    if (action === "sync") {
      if (!stripe) return json({ ok: false, error: "Stripe não configurado" }, 400);
      const { chargeId, error } = await resolveCharge(stripe, inv);
      if (!chargeId) {
        await admin.from("platform_invoices").update({ refund_sync_at: new Date().toISOString() }).eq("id", invoiceId);
        return json({ ok: false, error: error || "Sem cobrança Stripe associada", ...(await loadState()) }, 200);
      }
      const charge = await stripe.charges.retrieve(chargeId);
      const mirrored = await mirrorStripeRefunds(stripe, inv, chargeId, user.id);
      await admin.rpc("recalc_platform_invoice_refunds", { _invoice_id: invoiceId }).then(() => {}, () => {});

      const { data: after } = await admin.from("platform_invoices").select("amount_refunded, amount_total").eq("id", invoiceId).maybeSingle();
      const stripeRefunded = round2((charge.amount_refunded ?? 0) / 100);
      const mismatch = Math.abs(stripeRefunded - round2(Number(after?.amount_refunded) || 0)) > 0.005;
      await admin.from("platform_invoices").update({
        refund_sync_at: new Date().toISOString(),
        refund_mismatch: mismatch,
        stripe_status: charge.status ?? inv.stripe_status,
      }).eq("id", invoiceId);
      await logEvent(invoiceId, "refund_sync", mismatch ? "warn" : "info",
        `Sincronização Stripe: ${mirrored} reembolso(s), Stripe=${stripeRefunded}`, { mismatch, stripeRefunded });
      return json({ ok: true, mismatch, stripeRefunded, ...(await loadState()) });
    }

    // ───────────────────────── REFUND ─────────────────────────
    if (action === "refund") {
      if (!stripe) return json({ ok: false, error: "Stripe não configurado neste ambiente" }, 400);

      const state = await loadState();
      const requested = round2(Number(body.amount));
      const reason = (body.reason ? String(body.reason) : "").slice(0, 300);
      const notes = (body.notes ? String(body.notes) : "").slice(0, 1000);
      const clientKey = String(body.client_key || "").slice(0, 80);

      // ── Validações (nenhuma chamada ao Stripe se alguma falhar) ──
      if (!state.invoice?.paid_at) return json({ ok: false, error: "Este registo não corresponde a um pagamento confirmado." }, 400);
      if (state.shop?.is_demo === true) return json({ ok: false, error: "Contas de demonstração não são reembolsáveis." }, 400);
      if (!state.invoice?.stripe_invoice_id && !state.invoice?.stripe_payment_intent_id && !state.invoice?.stripe_charge_id) {
        return json({ ok: false, error: "Este pagamento não tem cobrança Stripe. Oferta ou plano atribuído não é reembolsável." }, 400);
      }
      if (state.paid <= 0) return json({ ok: false, error: "Valor pago é €0 — nada a reembolsar." }, 400);
      if (!SUPPORTED_CURRENCIES.includes(String(state.invoice.currency || "EUR").toUpperCase())) {
        return json({ ok: false, error: `Moeda não suportada (${state.invoice.currency}).` }, 400);
      }
      if (!Number.isFinite(requested) || requested <= 0) return json({ ok: false, error: "O valor do reembolso tem de ser superior a 0." }, 400);
      if (requested > state.available + 0.004) {
        return json({ ok: false, error: `Valor superior ao disponível (${state.available.toFixed(2)}).` }, 400);
      }

      // Um refund em processamento bloqueia novos pedidos (evita corridas).
      if (state.refunds.some((r: any) => r.status === "processing" || r.status === "pending")) {
        return json({ ok: false, error: "Já existe um reembolso em processamento neste pagamento." }, 409);
      }

      const { chargeId, piId, error: resolveErr } = await resolveCharge(stripe, state.invoice);
      if (!chargeId && !piId) {
        return json({ ok: false, error: resolveErr || "Não foi possível localizar a cobrança no Stripe." }, 400);
      }

      // ── Idempotência: chave estável por (pagamento, valor, pedido do cliente) ──
      const idem = `gf-refund:${invoiceId}:${toCents(requested)}:${clientKey || "default"}`;
      const { data: dup } = await admin.from("platform_refunds").select("*").eq("idempotency_key", idem).maybeSingle();
      if (dup && dup.status !== "failed") {
        return json({ ok: true, duplicate: true, refund: dup, ...(await loadState()) });
      }

      // Regista a intenção ANTES de chamar o Stripe (nunca como "reembolsado").
      const { data: pendingRow } = await admin.from("platform_refunds").upsert({
        platform_invoice_id: invoiceId,
        shop_id: state.invoice.shop_id,
        amount: requested,
        currency: String(state.invoice.currency || "EUR").toUpperCase(),
        status: "pending",
        reason: reason || null,
        notes: notes || null,
        stripe_charge_id: chargeId,
        stripe_payment_intent_id: piId,
        idempotency_key: idem,
        requested_by: user.id,
        requested_by_email: user.email ?? null,
        error_message: null,
      }, { onConflict: "idempotency_key" }).select("*").maybeSingle();

      try {
        const refund = await stripe.refunds.create(
          {
            ...(chargeId ? { charge: chargeId } : { payment_intent: piId! }),
            amount: toCents(requested),
            metadata: {
              source: "garageflow_admin",
              platform_invoice_id: invoiceId,
              shop_id: state.invoice.shop_id ?? "",
              admin_user_id: user.id,
              reason_text: reason.slice(0, 100),
            },
          },
          { idempotencyKey: idem },
        );

        const status = mapRefundStatus(refund.status);
        const { data: saved } = await admin.from("platform_refunds").update({
          stripe_refund_id: refund.id,
          status,
          raw_status: refund.status ?? null,
          confirmed_at: status === "succeeded" ? new Date().toISOString() : null,
          error_message: refund.failure_reason ?? null,
        }).eq("id", pendingRow!.id).select("*").maybeSingle();

        await admin.from("platform_invoices").update({ refund_sync_at: new Date().toISOString(), refund_mismatch: false }).eq("id", invoiceId);
        await logEvent(invoiceId, "refund_created", status === "succeeded" ? "info" : "warn",
          `Reembolso ${requested.toFixed(2)} — Stripe ${refund.status}`, { refund_id: refund.id, status: refund.status });
        await auditLog(user.id, "platform_refund_created", saved?.id ?? invoiceId, {
          platform_invoice_id: invoiceId, shop_id: state.invoice.shop_id, amount_original: state.paid,
          amount_refunded: requested, reason, stripe_refund_id: refund.id, result: refund.status,
        });

        return json({ ok: true, refund: saved, status, ...(await loadState()) });
      } catch (e) {
        const msg = (e as Error).message || "Erro desconhecido no Stripe";
        await admin.from("platform_refunds").update({
          status: "failed", error_message: msg.slice(0, 1000),
        }).eq("id", pendingRow!.id);
        await logEvent(invoiceId, "refund_failed", "error", `Falha no reembolso: ${msg}`);
        await auditLog(user.id, "platform_refund_failed", invoiceId, {
          platform_invoice_id: invoiceId, amount: requested, reason, error: msg,
        });
        return json({ ok: false, error: msg, ...(await loadState()) }, 200);
      }
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("[admin-refunds]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
