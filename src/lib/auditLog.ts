import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
}

export async function logAudit({ action, entityType, entityId, details }: AuditLogEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      user_id: user?.id || null,
      details: details || {},
    });
  } catch (e) {
    // Silent fail - audit logging should never break the app
    console.warn("Audit log failed:", e);
  }
}
