import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  action: z.enum(["status", "preview", "apply", "remove", "reconcile"]),
  shop_id: z.string().uuid(),
  condition_type: z.enum(["normal", "fixed_temporary", "fixed_permanent", "percent_temporary", "percent_permanent", "free_months", "dated"]).optional(),
  application_timing: z.enum(["immediate", "next_renewal", "specific_date"]).optional(),
  value_major: z.number().nonnegative().optional(),
  percent_off: z.number().positive().max(100).optional(),
  duration_months: z.number().int().positive().max(120).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  reason: z.string().min(2).max(120).optional(),
  internal_note: z.string().max(1000).optional(),
  request_key: z.string().min(12).max(120).optional(),
  proration_behavior: z.enum(["none", "create_prorations"]).default("none"),
});

type Body = z.infer<typeof BodySchema>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const addMonths = (seconds: number, months: number) => {
  const date = new Date(seconds * 1000);
  date.setUTCMonth(date.getUTCMonth() + months);
  return Math.floor(date.getTime() / 1000);
};

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("No such subscription")) return "A subscrição Stripe já não existe. Atualize o estado antes de tentar novamente.";
  if (message.includes("schedule")) return "O Stripe não conseguiu atualizar o calendário desta subscrição. A condição anterior foi mantida.";
  return message || "Não foi possível sincronizar a condição com o Stripe.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let conditionId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Autenticação obrigatória." }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Sessão inválida." }, 401);
    const { data: allowed } = await admin.rpc("is_super_admin", { _user_id: auth.user.id });
    if (allowed !== true) return json({ error: "Sem permissão financeira para esta operação." }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos.", fields: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe não está configurado.");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: subscription, error: subError } = await admin
      .from("subscriptions")
      .select("id,shop_id,plan,billing_cycle,status,trial_end,current_period_end,stripe_customer_id,stripe_subscription_id,cancel_at_period_end,commercial_condition_id")
      .eq("shop_id", body.shop_id)
      .maybeSingle();
    if (subError || !subscription) return json({ error: "A oficina não tem subscrição configurada." }, 404);

    const { data: shop } = await admin.from("shops").select("id,name,country_code,currency").eq("id", body.shop_id).maybeSingle();
    if (!shop) return json({ error: "Oficina não encontrada." }, 404);

    const country = String(shop.country_code || "PT").toUpperCase();
    const cycle = subscription.billing_cycle === "yearly" ? "yearly" : "monthly";
    const { data: priceRow } = await admin.from("plan_country_prices")
      .select("amount,currency,stripe_price_id")
      .eq("plan_slug", subscription.plan)
      .eq("country_code", country)
      .eq("cycle", cycle)
      .eq("active", true)
      .maybeSingle();
    if (!priceRow?.stripe_price_id) return json({ error: "O plano atual não tem preço Stripe configurado para este país e ciclo." }, 409);

    const stripeSubscription = subscription.stripe_subscription_id
      ? await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, { expand: ["schedule", "discounts"] })
      : null;
    const activeItem = stripeSubscription?.items.data[0];
    const stripeAmount = activeItem?.price.unit_amount;
    const baseMinor = stripeAmount ?? Math.round(Number(priceRow.amount) * 100);
    const currency = String(activeItem?.price.currency || priceRow.currency || shop.currency || "EUR").toUpperCase();

    const { data: history } = await admin.from("shop_commercial_conditions")
      .select("*").eq("shop_id", body.shop_id).order("created_at", { ascending: false }).limit(50);
    const current = (history || []).find((row: any) => ["pending", "active", "scheduled"].includes(row.status)) || null;

    const upcoming = async () => {
      if (!stripeSubscription) return null;
      try {
        const preview = await (stripe.invoices as any).createPreview({ subscription: stripeSubscription.id });
        return {
          amount_due_minor: Number(preview.amount_due || 0),
          currency: String(preview.currency || currency).toUpperCase(),
          next_payment_attempt: preview.next_payment_attempt ? new Date(preview.next_payment_attempt * 1000).toISOString() : null,
          period_end: preview.lines?.data?.[0]?.period?.end ? new Date(preview.lines.data[0].period.end * 1000).toISOString() : null,
        };
      } catch (error) {
        console.warn("[COMMERCIAL-CONDITION] upcoming preview unavailable", error);
        return null;
      }
    };

    if (body.action === "status") {
      return json({ shop, subscription, base_amount_minor: baseMinor, currency, stripe_connected: !!stripeSubscription, current, history: history || [], upcoming: await upcoming() });
    }

    if (body.action === "reconcile") {
      if (!stripeSubscription) return json({ error: "Esta oficina ainda não tem subscrição Stripe." }, 409);
      const stripeScheduleId = typeof stripeSubscription.schedule === "string" ? stripeSubscription.schedule : stripeSubscription.schedule?.id;
      const expectedSchedule = current?.stripe_schedule_id || null;
      const expectedDiscount = current?.stripe_coupon_id || null;
      const stripeDiscounts = ((stripeSubscription as any).discounts || []).map((d: any) => d.coupon?.id || d.source?.coupon).filter(Boolean);
      const synchronized = (!expectedSchedule || expectedSchedule === stripeScheduleId) && (!expectedDiscount || stripeDiscounts.includes(expectedDiscount) || !!stripeScheduleId);
      if (current) await admin.from("shop_commercial_conditions").update({ status: synchronized ? current.status : "sync_error", sync_error: synchronized ? null : "Divergência detetada no Stripe" }).eq("id", current.id);
      return json({ synchronized, stripe_schedule_id: stripeScheduleId || null, stripe_discount_ids: stripeDiscounts, upcoming: await upcoming() });
    }

    if (body.action === "preview") {
      const computed = computeCondition(body, baseMinor, stripeSubscription);
      return json({ ...computed, base_amount_minor: baseMinor, currency, subscription, upcoming: await upcoming(), stripe_connected: !!stripeSubscription });
    }

    if (body.action === "remove") {
      if (!current) return json({ error: "Não existe condição comercial ativa." }, 409);
      if (!stripeSubscription) {
        await admin.from("shop_commercial_conditions").update({ status: "cancelled", cancelled_by: auth.user.id, cancelled_at: new Date().toISOString() }).eq("id", current.id);
        await admin.from("subscriptions").update({ commercial_condition_id: null, effective_amount_minor: null, effective_currency: null }).eq("id", subscription.id);
        return json({ success: true, status: "cancelled" });
      }
      const scheduleId = typeof stripeSubscription.schedule === "string" ? stripeSubscription.schedule : stripeSubscription.schedule?.id;
      if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId, { preserve_cancel_date: true });
      await stripe.subscriptions.update(stripeSubscription.id, {
        discounts: [] as any,
        proration_behavior: body.proration_behavior,
        metadata: { ...stripeSubscription.metadata, commercial_condition_id: "" },
      });
      await admin.from("shop_commercial_conditions").update({ status: "cancelled", cancelled_by: auth.user.id, cancelled_at: new Date().toISOString(), sync_error: null }).eq("id", current.id);
      await admin.from("subscriptions").update({ commercial_condition_id: null, effective_amount_minor: baseMinor, effective_currency: currency }).eq("id", subscription.id);
      await admin.from("audit_logs").insert({ action: "commercial_condition_removed", entity_type: "subscription", entity_id: subscription.id, user_id: auth.user.id, details: { shop_id: body.shop_id, condition_id: current.id, stripe_subscription_id: stripeSubscription.id } });
      return json({ success: true, status: "cancelled", upcoming: await upcoming() });
    }

    if (!body.request_key || !body.condition_type || !body.reason) return json({ error: "Condição, motivo e chave do pedido são obrigatórios." }, 400);
    const computed = computeCondition(body, baseMinor, stripeSubscription);
    const startSeconds = computed.starts_at_seconds;
    const endSeconds = computed.ends_at_seconds;
    if (body.condition_type === "normal") return json({ error: "Use Remover condição para regressar ao preço normal." }, 400);

    const insertPayload = {
      shop_id: body.shop_id,
      subscription_id: subscription.id,
      plan_slug: subscription.plan,
      billing_cycle: cycle,
      condition_type: body.condition_type,
      status: "review_required",
      application_timing: body.application_timing || "next_renewal",
      value_minor: body.value_major == null ? null : Math.round(body.value_major * 100),
      percent_off: body.percent_off ?? null,
      currency,
      duration_months: body.duration_months ?? null,
      starts_at: new Date(startSeconds * 1000).toISOString(),
      ends_at: endSeconds ? new Date(endSeconds * 1000).toISOString() : null,
      reason: body.reason,
      internal_note: body.internal_note || null,
      base_amount_minor: baseMinor,
      effective_amount_minor: computed.effective_amount_minor,
      after_amount_minor: baseMinor,
      stripe_customer_id: subscription.stripe_customer_id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      request_key: body.request_key,
      created_by: auth.user.id,
    };
    const { data: inserted, error: insertError } = await admin.from("shop_commercial_conditions").insert(insertPayload).select("id").single();
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: duplicate } = await admin.from("shop_commercial_conditions").select("*").eq("request_key", body.request_key).single();
        return json({ success: true, duplicate: true, condition: duplicate });
      }
      throw insertError;
    }
    conditionId = inserted.id;

    const coupon = await stripe.coupons.create({
      ...(computed.percent_off != null ? { percent_off: computed.percent_off } : { amount_off: baseMinor - computed.effective_amount_minor, currency: currency.toLowerCase() }),
      duration: "forever",
      name: `GarageFlow · ${shop.name} · ${body.reason}`.slice(0, 40),
      metadata: { shop_id: body.shop_id, condition_id: conditionId, plan_slug: subscription.plan },
    }, { idempotencyKey: `${body.request_key}:coupon` });

    if (!stripeSubscription) {
      await admin.from("shop_commercial_conditions").update({ status: "scheduled", stripe_coupon_id: coupon.id, sync_error: null }).eq("id", conditionId);
      await admin.from("subscriptions").update({ commercial_condition_id: conditionId, effective_amount_minor: computed.effective_amount_minor, effective_currency: currency }).eq("id", subscription.id);
      return json({ success: true, prepared: true, condition_id: conditionId });
    }
    if (stripeSubscription.cancel_at_period_end || ["canceled", "unpaid", "incomplete_expired"].includes(stripeSubscription.status)) throw new Error("A subscrição está cancelada ou indisponível para alterações.");

    if (current && current.id !== conditionId) {
      await admin.from("shop_commercial_conditions").update({ status: "cancelled", cancelled_by: auth.user.id, cancelled_at: new Date().toISOString() }).eq("id", current.id);
    }

    let scheduleId: string | null = null;
    const isPermanent = ["fixed_permanent", "percent_permanent"].includes(body.condition_type);
    if (isPermanent && startSeconds <= Math.floor(Date.now() / 1000) + 60) {
      await stripe.subscriptions.update(stripeSubscription.id, {
        discounts: [{ coupon: coupon.id }],
        proration_behavior: body.proration_behavior,
        metadata: { ...stripeSubscription.metadata, commercial_condition_id: conditionId },
      }, { idempotencyKey: `${body.request_key}:subscription` });
    } else {
      const existingScheduleId = typeof stripeSubscription.schedule === "string" ? stripeSubscription.schedule : stripeSubscription.schedule?.id;
      if (existingScheduleId) throw new Error("A subscrição já tem um calendário Stripe. Remova primeiro a condição anterior ou conclua a alteração de plano agendada.");
      const schedule = await stripe.subscriptionSchedules.create({ from_subscription: stripeSubscription.id }, { idempotencyKey: `${body.request_key}:schedule` });
      scheduleId = schedule.id;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const currentPhaseStart = schedule.current_phase?.start_date || nowSeconds;
      const phases: any[] = [];
      if (startSeconds > nowSeconds + 60) {
        phases.push({ start_date: currentPhaseStart, end_date: startSeconds, items: [{ price: activeItem?.price.id || priceRow.stripe_price_id, quantity: activeItem?.quantity || 1 }], proration_behavior: "none", ...(stripeSubscription.trial_end && stripeSubscription.trial_end > currentPhaseStart ? { trial_end: stripeSubscription.trial_end } : {}) });
      }
      phases.push({
        start_date: startSeconds > nowSeconds + 60 ? startSeconds : currentPhaseStart,
        ...(endSeconds ? { end_date: endSeconds } : {}),
        items: [{ price: priceRow.stripe_price_id, quantity: activeItem?.quantity || 1 }],
        discounts: [{ coupon: coupon.id }],
        proration_behavior: body.proration_behavior,
        metadata: { commercial_condition_id: conditionId },
      });
      if (endSeconds) phases.push({ start_date: endSeconds, items: [{ price: priceRow.stripe_price_id, quantity: activeItem?.quantity || 1 }], proration_behavior: "none" });
      try {
        await stripe.subscriptionSchedules.update(schedule.id, { end_behavior: "release", phases });
      } catch (scheduleError) {
        await stripe.subscriptionSchedules.release(schedule.id, { preserve_cancel_date: true }).catch(() => undefined);
        throw scheduleError;
      }
    }

    const finalStatus = startSeconds > Math.floor(Date.now() / 1000) + 60 ? "scheduled" : "active";
    await admin.from("shop_commercial_conditions").update({
      status: finalStatus,
      stripe_coupon_id: coupon.id,
      stripe_schedule_id: scheduleId,
      stripe_snapshot: { subscription_status: stripeSubscription.status, schedule_id: scheduleId, coupon_id: coupon.id },
      sync_error: null,
    }).eq("id", conditionId);
    await admin.from("subscriptions").update({ commercial_condition_id: conditionId, effective_amount_minor: computed.effective_amount_minor, effective_currency: currency }).eq("id", subscription.id);
    await admin.from("audit_logs").insert({ action: "commercial_condition_applied", entity_type: "subscription", entity_id: subscription.id, user_id: auth.user.id, details: { shop_id: body.shop_id, condition_id: conditionId, type: body.condition_type, base_amount_minor: baseMinor, effective_amount_minor: computed.effective_amount_minor, currency, stripe_subscription_id: stripeSubscription.id, stripe_schedule_id: scheduleId, stripe_coupon_id: coupon.id } });

    return json({ success: true, condition_id: conditionId, status: finalStatus, upcoming: await upcoming() });
  } catch (error) {
    const message = publicMessage(error);
    console.error("[COMMERCIAL-CONDITION]", message);
    if (conditionId) {
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
      await admin.from("shop_commercial_conditions").update({ status: "review_required", sync_error: message }).eq("id", conditionId);
    }
    return json({ error: message }, 500);
  }
});

function computeCondition(body: Body, baseMinor: number, subscription: Stripe.Subscription | null) {
  const now = Math.floor(Date.now() / 1000);
  const renewal = subscription?.items.data[0]?.current_period_end ?? (subscription as any)?.current_period_end ?? now;
  const start = body.application_timing === "specific_date" && body.starts_at
    ? Math.floor(new Date(body.starts_at).getTime() / 1000)
    : body.application_timing === "immediate" ? now : renewal;
  if (!Number.isFinite(start) || start < now - 300) throw new Error("A data de início não é válida.");

  let effective = baseMinor;
  let percent: number | null = null;
  if (body.condition_type?.startsWith("percent")) {
    if (body.percent_off == null) throw new Error("Indique a percentagem de desconto.");
    percent = body.percent_off;
    effective = Math.max(0, Math.round(baseMinor * (1 - percent / 100)));
  } else if (body.condition_type === "free_months") {
    percent = 100;
    effective = 0;
  } else if (body.condition_type !== "normal") {
    if (body.value_major == null || body.value_major <= 0) throw new Error("Indique um preço personalizado superior a zero.");
    effective = Math.round(body.value_major * 100);
    if (effective >= baseMinor) throw new Error("O preço personalizado deve ser inferior ao preço padrão.");
  }

  const temporary = ["fixed_temporary", "percent_temporary", "free_months", "dated"].includes(body.condition_type || "");
  let end: number | null = null;
  if (body.ends_at) end = Math.floor(new Date(body.ends_at).getTime() / 1000);
  else if (temporary) {
    if (!body.duration_months) throw new Error("Indique uma duração válida.");
    end = addMonths(start, body.duration_months);
  }
  if (end != null && end <= start) throw new Error("A data final tem de ser posterior à data inicial.");
  return { effective_amount_minor: effective, percent_off: percent, starts_at_seconds: start, ends_at_seconds: end };
}