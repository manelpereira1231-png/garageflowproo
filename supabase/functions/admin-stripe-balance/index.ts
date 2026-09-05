/**
 * admin-stripe-balance — leitura tolerante a falhas do estado financeiro Stripe.
 *
 * Devolve saldo (disponível/pendente), taxas, reembolsos, pagamentos falhados e
 * chargebacks dos últimos 12 meses. Apenas super_admin.
 * Se o Stripe falhar, devolve { ok: false, error } com status 200 para que o
 * Admin continue funcional (regra: nenhuma API externa pode partir o Admin).
 */
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" });
    if (!isAdmin) return json({ ok: false, error: "forbidden" }, 403);

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ ok: false, error: "not_configured", status: "NAO_CONFIGURADO" });

    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const since = Math.floor(Date.now() / 1000) - 365 * 86400;

    const [balance, charges, refunds, disputes] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 100, created: { gte: since } }),
      stripe.refunds.list({ limit: 100, created: { gte: since } }),
      stripe.disputes.list({ limit: 100, created: { gte: since } }),
    ]);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / 100;
    const succeeded = charges.data.filter((c) => c.status === "succeeded" && !c.refunded);
    const failed = charges.data.filter((c) => c.status === "failed");

    // Taxas por mês (balance transactions das charges bem sucedidas)
    let fees = 0;
    try {
      const txns = await stripe.balanceTransactions.list({ limit: 100, created: { gte: since } });
      fees = sum(txns.data.map((t) => t.fee || 0));
    } catch (_) { /* taxas indisponíveis — não bloqueia */ }

    const byMonth: Record<string, number> = {};
    for (const c of succeeded) {
      const m = new Date(c.created * 1000).toISOString().slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + c.amount / 100;
    }

    return json({
      ok: true,
      syncedAt: new Date().toISOString(),
      balanceAvailable: sum(balance.available.map((b) => b.amount)),
      balancePending: sum(balance.pending.map((b) => b.amount)),
      currency: balance.available[0]?.currency?.toUpperCase() || "EUR",
      chargesTotal: sum(succeeded.map((c) => c.amount)),
      chargesCount: succeeded.length,
      failedCount: failed.length,
      failedAmount: sum(failed.map((c) => c.amount)),
      refundsTotal: sum(refunds.data.map((r) => r.amount)),
      refundsCount: refunds.data.length,
      disputesCount: disputes.data.length,
      disputesAmount: sum(disputes.data.map((d) => d.amount)),
      fees,
      revenueByMonth: byMonth,
    });
  } catch (error) {
    // Tolerância a falhas: 200 + ok:false para o Admin continuar a funcionar.
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
