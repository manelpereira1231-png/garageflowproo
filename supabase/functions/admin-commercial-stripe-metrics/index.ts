import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MoneyCents = Record<string, number>;
const ACTIVE_STATUSES = new Set(["active"]);
const BILLING_ACTIVE_STATUSES = new Set(["active", "trialing"]);
const INACTIVE_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired", "incomplete", "paused"]);

const log = (message: string, data?: unknown) =>
  console.log(`[ADMIN-COMMERCIAL-STRIPE-METRICS] ${message}`, data ? JSON.stringify(data) : "");

function addMoney(target: MoneyCents, currency: string | null | undefined, cents: number | null | undefined) {
  const key = (currency || "eur").toUpperCase();
  target[key] = (target[key] || 0) + Math.round(Number(cents || 0));
}

function mergeMoney(target: MoneyCents, source: MoneyCents) {
  Object.entries(source).forEach(([currency, cents]) => addMoney(target, currency, cents));
}

function toMajor(map: MoneyCents): Record<string, number> {
  return Object.fromEntries(Object.entries(map).map(([currency, cents]) => [currency, Number((cents / 100).toFixed(2))]));
}

function firstCurrency(...maps: MoneyCents[]): string {
  for (const map of maps) {
    const first = Object.keys(map)[0];
    if (first) return first;
  }
  return "EUR";
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("pt-PT", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function normalizePlan(price?: Stripe.Price | null): string {
  if (!price) return "Sem plano";
  const product = typeof price.product === "string" ? "" : price.product?.name || "";
  const raw = `${price.lookup_key || ""} ${price.nickname || ""} ${product}`.toLowerCase();
  if (raw.includes("garage")) return "Garage";
  if (raw.includes("pro")) return "Pro";
  if (raw.includes("starter")) return "Starter";
  return price.nickname || product || price.id;
}

function monthlySubscriptionCents(subscription: Stripe.Subscription): MoneyCents {
  const out: MoneyCents = {};
  for (const item of subscription.items.data) {
    const price = item.price;
    const quantity = item.quantity || 1;
    const unit = price.unit_amount ?? (price.unit_amount_decimal ? Math.round(Number(price.unit_amount_decimal)) : 0);
    const intervalCount = price.recurring?.interval_count || 1;
    let monthly = unit * quantity;
    if (price.recurring?.interval === "year") monthly = monthly / (12 * intervalCount);
    if (price.recurring?.interval === "week") monthly = (monthly * 52) / (12 * intervalCount);
    if (price.recurring?.interval === "day") monthly = (monthly * 365) / (12 * intervalCount);
    addMoney(out, price.currency, monthly);
  }
  return out;
}

class StripeMetricsService {
  private customers = new Map<string, Stripe.Customer | null>();
  constructor(private stripe: Stripe) {}

  private async getCustomer(customerRef: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<Stripe.Customer | null> {
    if (!customerRef) return null;
    if (typeof customerRef !== "string") return "deleted" in customerRef && customerRef.deleted ? null : customerRef as Stripe.Customer;
    if (this.customers.has(customerRef)) return this.customers.get(customerRef) || null;
    const customer = await this.stripe.customers.retrieve(customerRef);
    const normalized = !customer || ("deleted" in customer && customer.deleted) ? null : customer as Stripe.Customer;
    this.customers.set(customerRef, normalized);
    return normalized;
  }

  private customerName(customer: Stripe.Customer | null, fallback = "Cliente Stripe") {
    return customer?.name || customer?.email || fallback;
  }

  async build() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const monthStartTs = Math.floor(monthStart.getTime() / 1000);
    const prevMonthStartTs = Math.floor(prevMonthStart.getTime() / 1000);
    const yearAgoTs = Math.floor(yearAgo.getTime() / 1000);
    const thirtyDaysAgoTs = Math.floor(thirtyDaysAgo.getTime() / 1000);

    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
      return { key: monthKey(date), month: monthLabel(date), revenueCents: {} as MoneyCents, newSubscriptions: 0 };
    });
    const monthIndex = new Map(months.map((m) => [m.key, m]));

    const mrrCents: MoneyCents = {};
    const currentMonthInvoiceCents: MoneyCents = {};
    const previousMonthInvoiceCents: MoneyCents = {};
    const annualInvoiceCents: MoneyCents = {};
    const totalInvoiceCents: MoneyCents = {};
    const revenueByCustomer = new Map<string, MoneyCents>();
    const planCounts = new Map<string, number>();
    const activity: Array<{ id: string; type: "shop" | "payment" | "cancel"; label: string; sub: string; at: string }> = [];
    const atRisk: Array<{ id: string; name: string; reason: string; days: number }> = [];

    let payingSubscriptions = 0;
    let trialingSubscriptions = 0;
    let activeWorkshops = 0;
    let inactiveWorkshops = 0;
    let cancellationsLast30 = 0;
    const subscriptionCustomers = new Set<string>();

    for await (const subscription of this.stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.items.data.price.product"] }).autoPagingIterable()) {
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
      if (customerId) subscriptionCustomers.add(customerId);
      const status = subscription.status;
      if (ACTIVE_STATUSES.has(status)) {
        payingSubscriptions += 1;
        activeWorkshops += 1;
        mergeMoney(mrrCents, monthlySubscriptionCents(subscription));
        const plan = normalizePlan(subscription.items.data[0]?.price);
        planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
      } else if (status === "trialing") {
        trialingSubscriptions += 1;
        activeWorkshops += 1;
        const plan = normalizePlan(subscription.items.data[0]?.price);
        planCounts.set(`${plan} Trial`, (planCounts.get(`${plan} Trial`) || 0) + 1);
      } else if (INACTIVE_STATUSES.has(status)) {
        inactiveWorkshops += 1;
      }

      if (subscription.canceled_at && subscription.canceled_at >= thirtyDaysAgoTs) {
        cancellationsLast30 += 1;
        const customer = await this.getCustomer(subscription.customer as any);
        activity.push({ id: `cancel-${subscription.id}`, type: "cancel", label: this.customerName(customer, "Subscrição cancelada"), sub: "Cancelamento Stripe", at: new Date(subscription.canceled_at * 1000).toISOString() });
      }

      if (subscription.trial_end && status === "trialing") {
        const daysLeft = Math.ceil((subscription.trial_end * 1000 - now.getTime()) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 3) {
          const customer = await this.getCustomer(subscription.customer as any);
          atRisk.push({ id: subscription.id, name: this.customerName(customer, "Cliente em trial"), reason: "Trial Stripe a expirar", days: daysLeft });
        }
      }
      if (status === "past_due" || status === "unpaid") {
        const customer = await this.getCustomer(subscription.customer as any);
        atRisk.push({ id: subscription.id, name: this.customerName(customer, "Cliente Stripe"), reason: status === "past_due" ? "Pagamento em atraso" : "Pagamento falhado", days: 0 });
      }

      const bucket = monthIndex.get(monthKey(new Date(subscription.created * 1000)));
      if (bucket) bucket.newSubscriptions += 1;
    }

    for await (const invoice of this.stripe.invoices.list({ status: "paid", limit: 100 }).autoPagingIterable()) {
      const paidAt = invoice.status_transitions?.paid_at || invoice.created;
      const paidCents = invoice.amount_paid || 0;
      addMoney(totalInvoiceCents, invoice.currency, paidCents);
      const paidDate = new Date(paidAt * 1000);
      if (paidAt >= yearAgoTs) {
        addMoney(annualInvoiceCents, invoice.currency, paidCents);
        const bucket = monthIndex.get(monthKey(paidDate));
        if (bucket) addMoney(bucket.revenueCents, invoice.currency, paidCents);
      }
      if (paidAt >= monthStartTs) addMoney(currentMonthInvoiceCents, invoice.currency, paidCents);
      if (paidAt >= prevMonthStartTs && paidAt < monthStartTs) addMoney(previousMonthInvoiceCents, invoice.currency, paidCents);
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const current = revenueByCustomer.get(customerId) || {};
        addMoney(current, invoice.currency, paidCents);
        revenueByCustomer.set(customerId, current);
      }
    }

    const recentInvoices = await this.stripe.invoices.list({ status: "paid", limit: 8 });
    for (const invoice of recentInvoices.data) {
      const customer = await this.getCustomer(invoice.customer as any);
      activity.push({ id: `invoice-${invoice.id}`, type: "payment", label: this.customerName(customer, "Pagamento Stripe"), sub: "Invoice Stripe paga", at: new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000).toISOString() });
    }

    let trialToPaidConversions = 0;
    for await (const event of this.stripe.events.list({ type: "customer.subscription.updated", created: { gte: yearAgoTs }, limit: 100 }).autoPagingIterable()) {
      const previous = (event.data as any).previous_attributes;
      const current = event.data.object as Stripe.Subscription;
      if (previous?.status === "trialing" && current.status === "active") trialToPaidConversions += 1;
    }

    let cumulative = 0;
    const monthlySeries = months.map((m) => {
      cumulative += m.newSubscriptions;
      return { month: m.month, newSubscriptions: m.newSubscriptions, activeSubscriptions: cumulative, revenue: toMajor(m.revenueCents) };
    });

    const primaryCurrency = firstCurrency(mrrCents, currentMonthInvoiceCents, totalInvoiceCents);
    const arpuCents: MoneyCents = {};
    if (payingSubscriptions > 0) Object.entries(mrrCents).forEach(([currency, cents]) => { arpuCents[currency] = Math.round(cents / payingSubscriptions); });
    const currentPrimary = currentMonthInvoiceCents[primaryCurrency] || 0;
    const previousPrimary = previousMonthInvoiceCents[primaryCurrency] || 0;
    const monthGrowth = previousPrimary > 0 ? ((currentPrimary - previousPrimary) / previousPrimary) * 100 : 0;
    const churnRate = (payingSubscriptions + cancellationsLast30) > 0 ? (cancellationsLast30 / (payingSubscriptions + cancellationsLast30)) * 100 : 0;
    const retentionRate = Math.max(0, 100 - churnRate);
    const conversionRate = (trialToPaidConversions + trialingSubscriptions) > 0 ? (trialToPaidConversions / (trialToPaidConversions + trialingSubscriptions)) * 100 : 0;

    const topCustomers = [];
    for (const [customerId, revenue] of [...revenueByCustomer.entries()].sort(([, a], [, b]) => (b[primaryCurrency] || Object.values(b)[0] || 0) - (a[primaryCurrency] || Object.values(a)[0] || 0)).slice(0, 5)) {
      const customer = await this.getCustomer(customerId);
      topCustomers.push({ id: customerId, name: this.customerName(customer, "Cliente Stripe"), email: customer?.email || null, revenue: toMajor(revenue), plan: null });
    }

    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      generated_at: now.toISOString(),
      source: "stripe_live_api",
      primaryCurrency,
      mrr: toMajor(mrrCents),
      monthlyRevenue: toMajor(currentMonthInvoiceCents),
      annualRevenue: toMajor(annualInvoiceCents),
      totalRevenue: toMajor(totalInvoiceCents),
      arpu: toMajor(arpuCents),
      monthGrowth,
      payingSubscriptions,
      trialingSubscriptions,
      trialToPaidConversions,
      conversionRate,
      cancellationsLast30,
      churnRate,
      retentionRate,
      activeWorkshops,
      inactiveWorkshops,
      stripeCustomersWithSubscriptions: subscriptionCustomers.size,
      monthlySeries,
      planSeries: [...planCounts.entries()].map(([plan, count]) => ({ plan, count })),
      activity: activity.slice(0, 10),
      topCustomers,
      atRisk: atRisk.slice(0, 6),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const { data: roles, error: roleError } = await supabaseClient.from("user_roles").select("role").eq("user_id", userData.user.id).in("role", ["commercial_admin", "super_admin", "admin"]);
    if (roleError || !Array.isArray(roles) || roles.length === 0) throw new Error("Not authorized");

    const service = new StripeMetricsService(new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }));
    const metrics = await service.build();
    return new Response(JSON.stringify(metrics), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: message === "Not authorized" ? 403 : 500 });
  }
});