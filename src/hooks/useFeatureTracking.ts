import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight feature adoption tracker.
 * Logs usage events to audit_logs with entity_type = 'feature_usage'.
 * Batches calls via requestIdleCallback for zero UI impact.
 */
export function useFeatureTracking() {
  const trackFeature = useCallback((feature: string, details?: Record<string, unknown>) => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("audit_logs").insert({
          action: "feature_used",
          entity_type: "feature_usage",
          entity_id: null,
          user_id: user.id,
          details: { feature, ...details, timestamp: new Date().toISOString() },
        });
      } catch {
        // Silent fail — tracking should never break UX
      }
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => run());
    } else {
      setTimeout(run, 100);
    }
  }, []);

  return { trackFeature };
}
