/**
 * invoice-pay
 * -----------
 * Pagamento online de uma fatura a partir do link público (text-to-pay).
 *
 * action = "checkout"  → cria uma Stripe Checkout Session na conta Connect da
 *                        oficina (o dinheiro entra diretamente na oficina).
 * action = "confirm"   → valida a sessão no regresso e marca a fatura como paga.
 *
 * Público (sem sessão): a autorização vem do token opaco da fatura.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Pagamentos online não estão configurados." }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { token, action = "checkout", session_id, origin, return_url } = await req.json().catch(() => ({}));
    if (!token) return json({ error: "Link inválido." }, 400);

    const { data: inv } = await admin
      .from("invoices")
      .select("id, number, total, status, paid_online_at, payment_link_sent_at, shop_id, stripe_payment_session_id")
      .eq("public_token", token)
      .maybeSingle();

    if (!inv || !inv.payment_link_sent_at) return json({ error: "Fatura não encontrada." }, 404);

    const { data: shop } = await admin
      .from("shops")
      .select("name, currency, stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", inv.shop_id)
      .maybeSingle();

    // Se a oficina tem Stripe Connect ativo o dinheiro entra diretamente na
    // oficina; caso contrário usamos a conta Stripe da plataforma (a mesma dos
    // planos SaaS) para que o pagamento online funcione na mesma.
    const connectAccount =
      shop?.stripe_connect_account_id && shop?.stripe_connect_charges_enabled
        ? shop.stripe_connect_account_id
        : undefined;

    // ── Confirmar pagamento no regresso do Stripe ───────────────────────────
    if (action === "confirm") {
      if (inv.paid_online_at) return json({ paid: true });
      if (!session_id) return json({ error: "Sessão em falta." }, 400);
      const session = await stripe.checkout.sessions.retrieve(
        session_id,
        connectAccount ? { stripeAccount: connectAccount } : undefined,
      );
      if (session.payment_status !== "paid") return json({ paid: false });
      await admin.from("invoices").update({
        paid_online_at: new Date().toISOString(),
        status: "paid",
        stripe_payment_session_id: session.id,
      }).eq("id", inv.id);
      return json({ paid: true });
    }

    // ── Criar sessão de pagamento ───────────────────────────────────────────
    if (inv.paid_online_at || inv.status === "paid") return json({ error: "Esta fatura já está paga." }, 400);

    const amount = Math.round(Number(inv.total || 0) * 100);
    if (amount <= 0) return json({ error: "Valor da fatura inválido." }, 400);

    // Comissão da plataforma (nunca fixa no código) — platform_settings.invoice_payments
    let feePercent = 3;
    const { data: feeSetting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "invoice_payments")
      .maybeSingle();
    const rawFee = (feeSetting?.value as { platform_fee_percent?: number } | null)?.platform_fee_percent;
    if (typeof rawFee === "number" && rawFee >= 0 && rawFee <= 30) feePercent = rawFee;
    const applicationFee = connectAccount ? Math.round((amount * feePercent) / 100) : 0;

    const base = origin || req.headers.get("origin") || "https://garageflow.pt";
    const successBase = return_url || `${base}/invoice/${token}`;
    const joiner = successBase.includes("?") ? "&" : "?";
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{
          price_data: {
            currency: String(shop?.currency || "EUR").toLowerCase(),
            product_data: { name: `Fatura ${inv.number} — ${shop?.name ?? ""}` },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        success_url: `${successBase}${joiner}invoice_token=${token}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${successBase}${joiner}canceled=1`,
        metadata: { invoice_id: inv.id, invoice_number: String(inv.number ?? "") },
        ...(connectAccount && applicationFee > 0
          ? { payment_intent_data: { application_fee_amount: applicationFee } }
          : {}),
      },
      connectAccount ? { stripeAccount: connectAccount } : undefined,
    );

    await admin.from("invoices")
      .update({ stripe_payment_session_id: session.id })
      .eq("id", inv.id);

    return json({ url: session.url });

  } catch (e: any) {
    console.error("[invoice-pay]", e);
    return json({ error: e?.message || "Erro no pagamento" }, 500);
  }
});
