import { useEffect, useState } from "react";

export type OnboardingStatus = "guided" | "completed";

export const ONBOARDING_STATUS_KEY = "garageflow_onboarding_status";
export const ONBOARDING_LEGACY_KEY = "garageflow_onboarding_completed";
export const ONBOARDING_DISMISSED_KEY = "gf_auto_onboarding_dismissed";
export const ONBOARDING_STATE_EVENT = "garageflow:onboarding-state-changed";

const isBrowser = typeof window !== "undefined";

const readOnboardingStatus = (): OnboardingStatus => {
  if (!isBrowser) return "guided";

  const storedStatus = window.localStorage.getItem(ONBOARDING_STATUS_KEY);
  if (storedStatus === "guided" || storedStatus === "completed") {
    return storedStatus;
  }

  return window.localStorage.getItem(ONBOARDING_LEGACY_KEY) === "true" ? "completed" : "guided";
};

const emitOnboardingChange = (status: OnboardingStatus) => {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_STATE_EVENT, { detail: status }));
};

export function getOnboardingStatus(): OnboardingStatus {
  return readOnboardingStatus();
}

export function setOnboardingStatus(status: OnboardingStatus) {
  if (!isBrowser) return;

  window.localStorage.setItem(ONBOARDING_STATUS_KEY, status);
  window.localStorage.setItem(ONBOARDING_LEGACY_KEY, status === "completed" ? "true" : "false");
  emitOnboardingChange(status);
}

export function completeOnboarding() {
  setOnboardingStatus("completed");
}

export function resetOnboarding() {
  if (!isBrowser) return;

  window.localStorage.removeItem(ONBOARDING_STATUS_KEY);
  window.localStorage.removeItem(ONBOARDING_LEGACY_KEY);
  window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
  emitOnboardingChange("guided");
}

export function useOnboardingStatus() {
  const [onboardingStatus, setLocalOnboardingStatus] = useState<OnboardingStatus>(() => readOnboardingStatus());

  useEffect(() => {
    if (!isBrowser) return;

    const syncOnboardingStatus = () => {
      setLocalOnboardingStatus(readOnboardingStatus());
    };

    syncOnboardingStatus();
    window.addEventListener(ONBOARDING_STATE_EVENT, syncOnboardingStatus as EventListener);
    window.addEventListener("storage", syncOnboardingStatus);

    return () => {
      window.removeEventListener(ONBOARDING_STATE_EVENT, syncOnboardingStatus as EventListener);
      window.removeEventListener("storage", syncOnboardingStatus);
    };
  }, []);

  return {
    onboardingStatus,
    isGuidedMode: onboardingStatus === "guided",
    isCompleted: onboardingStatus === "completed",
    setOnboardingStatus,
    completeOnboarding,
    resetOnboarding,
  };
}

declare global {
  interface Window {
    resetOnboarding?: () => void;
  }
}

if (isBrowser) {
  window.resetOnboarding = resetOnboarding;
}