import { supabase } from "@/integrations/supabase/client";

type LifecycleKey = "welcome" | "first_quote" | "first_work_order" | "invoice_created";

export async function sendLifecycleEmail(params: {
  shopId: string;
  templateKey: LifecycleKey;
  entityId: string;
  recipient: string;
  data?: Record<string, string | number | undefined>;
}) {
  if (!params.recipient || !params.shopId || !params.entityId) return;
  try {
    await supabase.functions.invoke("send-lifecycle-email", {
      body: {
        shop_id: params.shopId,
        template_key: params.templateKey,
        entity_id: params.entityId,
        recipient: params.recipient,
        data: params.data ?? {},
      },
    });
  } catch (err) {
    console.warn("lifecycle email skipped", err);
  }
}
