import { supabase } from "@/integrations/supabase/client";

export type FunnelStage = "impression" | "view" | "intent" | "action" | "conversion";
export type FunnelEntity = "listing" | "shop" | "blog" | "user" | "campaign";

/**
 * Record a funnel event. Fire-and-forget — never blocks the UI.
 * Backed by public.funnel_events via record_funnel_event RPC.
 */
export function recordFunnel(
  entity_type: FunnelEntity,
  entity_id: string | null,
  stage: FunnelStage,
  metadata: Record<string, unknown> = {},
  source_event?: string,
): void {
  try {
    supabase.rpc("record_funnel_event", {
      _entity_type: entity_type,
      _entity_id: entity_id as string,
      _stage: stage,
      _user_id: null,
      _source_event: source_event ?? null,
      _metadata: metadata as never,
    }).then(() => {}, () => {});
  } catch {
    /* swallow */
  }
}
