/**
 * Unified event tracking — replaces ad-hoc tracking scattered across the app.
 *
 * Usage:
 *   trackEvent("listing_view", { listing_id });
 *   trackEvent("signup", { plan: "pro" });
 *
 * Writes to public.event_logs via the `track_event` RPC. Fire-and-forget,
 * never blocks the UI, never throws.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "gf_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export type GFEvent =
  | "listing_view"
  | "contact_clicked"
  | "signup"
  | "login"
  | "escrow_released"
  | "review_submitted"
  | "search_used"
  | "page_view"
  | (string & {});

export function trackEvent(
  event: GFEvent,
  payload: Record<string, unknown> = {},
  shopId?: string | null,
): void {
  const run = async () => {
    try {
      await supabase.rpc("track_event", {
        _event_name: event,
        _payload: payload as any,
        _shop_id: shopId ?? null,
        _session_id: getSessionId(),
      });
    } catch {
      /* silent */
    }
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => run(), { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}

/** Update last_seen_at for current user (and optionally a shop). */
export function touchActivity(shopId?: string | null): void {
  const run = async () => {
    try {
      await supabase.rpc("touch_user_activity", { _shop_id: shopId ?? null });
    } catch {
      /* silent */
    }
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => run(), { timeout: 3000 });
  } else {
    setTimeout(run, 0);
  }
}
