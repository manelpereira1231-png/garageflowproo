/**
 * Google Ads Tracking Utilities
 * ID: AW-18023581561
 * 
 * Captures gclid, UTM params, and provides conversion helpers.
 */

const GADS_ID = 'AW-18023581561';
const STORAGE_KEY = 'gf_ads_meta';

interface AdsMeta {
  gclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landing_page?: string;
  referrer?: string;
  timestamp?: string;
}

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag(...args);
  }
}

/** Capture gclid + UTM params from URL on first visit, persist to sessionStorage */
export function captureAdsParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const existing = getAdsMeta();

    const meta: AdsMeta = {
      ...existing,
      landing_page: existing.landing_page || window.location.pathname,
      referrer: existing.referrer || document.referrer || '',
      timestamp: existing.timestamp || new Date().toISOString(),
    };

    // Only overwrite if present in URL
    const keys: (keyof AdsMeta)[] = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    keys.forEach(key => {
      const val = params.get(key);
      if (val) meta[key] = val;
    });

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Private browsing or storage full — silently ignore
  }
}

export function getAdsMeta(): AdsMeta {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Track CTA button clicks as custom events for Google Ads optimization */
export function trackCtaClick(ctaName: string) {
  gtag('event', 'cta_click', {
    event_category: 'engagement',
    event_label: ctaName,
    send_to: GADS_ID,
  });
}

/** Track when user reaches the signup page — micro-conversion */
export function trackSignupPageView() {
  gtag('event', 'begin_sign_up', {
    event_category: 'conversion',
    send_to: GADS_ID,
  });
}

/** Track successful signup — main conversion */
export function trackSignupConversion(email?: string) {
  gtag('event', 'conversion', {
    send_to: GADS_ID,
    value: 1.0,
    currency: 'EUR',
  });

  // Enhanced conversions: send hashed user data for better matching
  if (email) {
    gtag('set', 'user_data', {
      email: email,
    });
  }
}

/** Track pricing section view — engagement signal */
export function trackPricingView() {
  gtag('event', 'view_item_list', {
    event_category: 'engagement',
    event_label: 'pricing_section',
    send_to: GADS_ID,
  });
}

/** Track scroll depth milestones */
export function trackScrollDepth(percent: number) {
  gtag('event', 'scroll', {
    event_category: 'engagement',
    event_label: `${percent}%`,
    send_to: GADS_ID,
  });
}
