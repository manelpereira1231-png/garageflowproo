/**
 * Platform settings (admin-managed) — single source of truth for plan
 * limits and feature gates. Mirrors keys saved by the Admin > Settings
 * page (`platform_settings` table).
 *
 * Cache + global event so any hook/page re-reads instantly after save:
 *   window.dispatchEvent(new CustomEvent("garageflow:platform-settings-updated"))
 */
import { supabase } from "@/integrations/supabase/client";

export interface PlanLimitsRow {
  freePlanEnabled: boolean;
  proPlanEnabled: boolean;
  garagePlanEnabled: boolean;
  freeQuoteLimit: number;
  freeUserLimit: number;
  proUserLimit: number;
  garageUserLimit: number;
  trialDays: number;
  freeMaxShops: number;
  proMaxShops: number;
  garageMaxShops: number;
}

export interface FeatureGatesRow {
  freeFeatures: string[];
  proFeatures: string[];
  garageFeatures: string[];
}

export interface PdfRow { watermarkOnFree: boolean; }
export interface NotificationsRow {
  autoAlerts: boolean;
  emailNotifications: boolean;
  alertFollowUpDays: number;
  alertMaxFollowUps: number;
  inactiveClientDays: number;
  reminderDaysBefore: number;
}

export interface PlatformSettings {
  planLimits: PlanLimitsRow;
  featureGates: FeatureGatesRow;
  pdf: PdfRow;
  notifications: NotificationsRow;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  planLimits: {
    freePlanEnabled: true, proPlanEnabled: true, garagePlanEnabled: true,
    freeQuoteLimit: 10, freeUserLimit: 1, proUserLimit: 5, garageUserLimit: 999,
    trialDays: 30, freeMaxShops: 1, proMaxShops: 1, garageMaxShops: 5,
  },
  featureGates: {
    freeFeatures: ["quotes","work_orders","clients","invoices","service_catalog"],
    proFeatures: [
      "quotes","work_orders","clients","invoices","service_catalog",
      "alerts_basic","team","agenda","reports_basic","csv_export",
      "quote_approval","client_portal","stock","inspections",
    ],
    garageFeatures: [
      "quotes","work_orders","clients","invoices","alerts_basic","alerts_advanced",
      "team","chat","marketing","loyalty","stock","inspections","agenda",
      "reports_basic","reports_advanced","multi_shop","csv_export","api",
      "quote_approval","client_portal","service_catalog","automations",
    ],
  },
  pdf: { watermarkOnFree: true },
  notifications: {
    autoAlerts: true, emailNotifications: true,
    alertFollowUpDays: 3, alertMaxFollowUps: 3,
    inactiveClientDays: 90, reminderDaysBefore: 7,
  },
};

let cache: PlatformSettings | null = null;
let inflight: Promise<PlatformSettings> | null = null;

export function getCachedPlatformSettings(): PlatformSettings {
  return cache ?? DEFAULT_PLATFORM_SETTINGS;
}

export async function loadPlatformSettings(force = false): Promise<PlatformSettings> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("key,value");
      const merged: PlatformSettings = JSON.parse(JSON.stringify(DEFAULT_PLATFORM_SETTINGS));
      (data || []).forEach((row: any) => {
        if (row.key === "plan_limits") merged.planLimits = { ...merged.planLimits, ...row.value };
        if (row.key === "feature_gates") merged.featureGates = { ...merged.featureGates, ...row.value };
        if (row.key === "pdf") merged.pdf = { ...merged.pdf, ...row.value };
        if (row.key === "notifications") merged.notifications = { ...merged.notifications, ...row.value };
      });
      cache = merged;
      return merged;
    } catch {
      cache = DEFAULT_PLATFORM_SETTINGS;
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearPlatformSettingsCache() {
  cache = null;
  inflight = null;
}

/** Notify every listener (useSubscription, gates) to re-fetch. */
export function notifyPlatformSettingsUpdated() {
  clearPlatformSettingsCache();
  try {
    window.dispatchEvent(new CustomEvent("garageflow:platform-settings-updated"));
  } catch { /* ignore (SSR) */ }
}

/**
 * Maps the admin-editable feature key (e.g. "alerts_basic") to the
 * boolean keys consumed by useSubscription/PlanLimits across the app.
 */
const FEATURE_KEY_TO_LIMIT: Record<string, string[]> = {
  alerts_basic: ["basicAlerts"],
  alerts_advanced: ["advancedAlerts"],
  team: ["teamManagement"],
  chat: ["chatbot"],
  marketing: ["marketing"],
  loyalty: ["loyalty"],
  inspections: ["fullInspections"],
  reports_basic: ["basicReports"],
  reports_advanced: ["advancedReports"],
  multi_shop: ["multiShop"],
  csv_export: ["csvExport"],
  api: ["api"],
  quote_approval: ["quoteApproval"],
  automations: ["automations", "basicAutomations"],
};

export function planFeatureKeysFor(plan: "free" | "pro" | "garage", gates: FeatureGatesRow): string[] {
  if (plan === "garage") return gates.garageFeatures;
  if (plan === "pro") return gates.proFeatures;
  return gates.freeFeatures;
}

/** Returns the limit-key overrides derived from feature gates for a given plan. */
export function limitOverridesFor(plan: "free" | "pro" | "garage", settings: PlatformSettings): Record<string, boolean | number> {
  const keys = planFeatureKeysFor(plan, settings.featureGates);
  const out: Record<string, boolean | number> = {};
  // Reset every gated feature to false, then enable the ones present.
  Object.values(FEATURE_KEY_TO_LIMIT).flat().forEach(k => { out[k] = false; });
  keys.forEach(k => {
    (FEATURE_KEY_TO_LIMIT[k] || []).forEach(limitKey => { out[limitKey] = true; });
  });
  // Quotas
  if (plan === "free") {
    out.maxQuotesPerMonth = settings.planLimits.freeQuoteLimit;
    out.maxUsers = settings.planLimits.freeUserLimit;
  } else if (plan === "pro") {
    out.maxQuotesPerMonth = Infinity;
    out.maxUsers = settings.planLimits.proUserLimit;
  } else {
    out.maxQuotesPerMonth = Infinity;
    out.maxUsers = settings.planLimits.garageUserLimit === 999 ? Infinity : settings.planLimits.garageUserLimit;
  }
  // PDF watermark applies to free only
  out.pdfWatermark = plan === "free" && settings.pdf.watermarkOnFree;
  return out;
}
