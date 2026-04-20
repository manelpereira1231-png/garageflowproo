import { useEffect, useState } from "react";

/**
 * App mode controls the entire UI density of the ERP.
 * - `lite`  → simplified sidebar (5 essentials), guided dashboard, no advanced widgets.
 *            This is the DEFAULT for every user, every session.
 * - `pro`   → full SaaS with all modules, dashboards and KPIs.
 *
 * The legacy concept of "onboarding completed" no longer toggles the mode.
 * Users explicitly switch via the topbar toggle (Lite ⇄ Pro) — same UX as
 * Binance / Coinbase. Choice persists in localStorage.
 */
export type OnboardingStatus = "guided" | "completed";
export type AppMode = "lite" | "pro";

export const APP_MODE_KEY = "garageflow_app_mode";
export const ONBOARDING_STATUS_KEY = "garageflow_onboarding_status"; // legacy
export const ONBOARDING_LEGACY_KEY = "garageflow_onboarding_completed"; // legacy
export const ONBOARDING_DISMISSED_KEY = "gf_auto_onboarding_dismissed";
export const ONBOARDING_STATE_EVENT = "garageflow:onboarding-state-changed";

const isBrowser = typeof window !== "undefined";

const readAppMode = (): AppMode => {
  if (!isBrowser) return "lite";
  const stored = window.localStorage.getItem(APP_MODE_KEY);
  if (stored === "lite" || stored === "pro") return stored;
  // Default: every fresh visit starts in Lite Mode.
  return "lite";
};

const emitChange = (mode: AppMode) => {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_STATE_EVENT, { detail: mode }));
};

export function getAppMode(): AppMode {
  return readAppMode();
}

export function setAppMode(mode: AppMode) {
  if (!isBrowser) return;
  window.localStorage.setItem(APP_MODE_KEY, mode);
  // Keep legacy keys aligned so any old code paths still work.
  window.localStorage.setItem(ONBOARDING_STATUS_KEY, mode === "lite" ? "guided" : "completed");
  window.localStorage.setItem(ONBOARDING_LEGACY_KEY, mode === "pro" ? "true" : "false");
  emitChange(mode);
}

// ─── Backwards-compatible API ───────────────────────────────────────────────
// Kept so existing call sites (Auth.tsx, QuoteForm.tsx, Layout.tsx, etc.)
// continue to compile without sweeping refactors.

export function getOnboardingStatus(): OnboardingStatus {
  return readAppMode() === "lite" ? "guided" : "completed";
}

export function setOnboardingStatus(status: OnboardingStatus) {
  setAppMode(status === "guided" ? "lite" : "pro");
}

/** Legacy: previously auto-flipped to Pro after creating client+vehicle+quote.
 *  Now a no-op — the user controls the mode via the topbar toggle. */
export function completeOnboarding() {
  /* intentionally no-op */
}

export function resetOnboarding() {
  if (!isBrowser) return;
  window.localStorage.removeItem(APP_MODE_KEY);
  window.localStorage.removeItem(ONBOARDING_STATUS_KEY);
  window.localStorage.removeItem(ONBOARDING_LEGACY_KEY);
  window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
  emitChange("lite");
}

export function useAppMode() {
  const [mode, setMode] = useState<AppMode>(() => readAppMode());

  useEffect(() => {
    if (!isBrowser) return;
    const sync = () => setMode(readAppMode());
    sync();
    window.addEventListener(ONBOARDING_STATE_EVENT, sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ONBOARDING_STATE_EVENT, sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    mode,
    isLite: mode === "lite",
    isPro: mode === "pro",
    setMode: setAppMode,
    toggle: () => setAppMode(mode === "lite" ? "pro" : "lite"),
  };
}

export function useOnboardingStatus() {
  const { mode, setMode } = useAppMode();
  const onboardingStatus: OnboardingStatus = mode === "lite" ? "guided" : "completed";
  return {
    onboardingStatus,
    isGuidedMode: mode === "lite",
    isCompleted: mode === "pro",
    setOnboardingStatus: (s: OnboardingStatus) => setMode(s === "guided" ? "lite" : "pro"),
    completeOnboarding,
    resetOnboarding,
  };
}

declare global {
  interface Window {
    resetOnboarding?: () => void;
    setAppMode?: (mode: AppMode) => void;
  }
}

if (isBrowser) {
  window.resetOnboarding = resetOnboarding;
  window.setAppMode = setAppMode;
}
