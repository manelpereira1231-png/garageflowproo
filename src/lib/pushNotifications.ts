import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a push notification to all subscribed users of a shop.
 * Non-blocking: errors are logged but don't interrupt the caller.
 */
export async function sendPushNotification(
  shopId: string,
  title: string,
  body: string,
  url?: string
) {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;

    await fetch(
      `https://${projectId}.supabase.co/functions/v1/send-push`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, title, body, url }),
      }
    );
  } catch (err) {
    console.warn("Push notification failed (non-blocking):", err);
  }
}
