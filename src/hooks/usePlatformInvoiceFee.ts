import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_INVOICE_FEE_PERCENT = 3;

/**
 * Taxa da plataforma aplicada aos pagamentos online de faturas quando a
 * oficina recebe diretamente na sua conta Stripe Connect.
 * Nunca é fixa no código — vem sempre de platform_settings.invoice_payments.
 */
export function usePlatformInvoiceFee() {
  const [feePercent, setFeePercent] = useState<number>(DEFAULT_INVOICE_FEE_PERCENT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "invoice_payments")
      .maybeSingle();
    const raw = (data?.value as { platform_fee_percent?: number } | null)?.platform_fee_percent;
    if (typeof raw === "number" && raw >= 0) setFeePercent(raw);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { feePercent, loading, reload: load };
}
