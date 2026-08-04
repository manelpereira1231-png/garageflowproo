import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_INVOICE_FEE_PERCENT = 3;

export interface PaymentFeeSettings {
  /** Comissão base retida via Stripe Connect (%). */
  feePercent: number;
  /** Permite pagamentos online a oficinas SEM Stripe Connect. */
  allowWithoutConnect: boolean;
  /** Percentagem adicional aplicada quando não há Stripe Connect. */
  noConnectExtraPercent: number;
  /** Taxa fixa adicional por pagamento sem Stripe Connect. */
  noConnectFixedFee: number;
}

export const FALLBACK_FEE_SETTINGS: PaymentFeeSettings = {
  feePercent: DEFAULT_INVOICE_FEE_PERCENT,
  allowWithoutConnect: true,
  noConnectExtraPercent: 0,
  noConnectFixedFee: 0,
};

const num = (v: unknown, fallback: number) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Configuração global de comissões dos pagamentos online de faturas.
 * Fonte única de verdade: `platform_settings.invoice_payments`
 * (editável apenas pelo Super Admin em /admin/payment-fees).
 */
export function usePlatformInvoiceFee() {
  const [settings, setSettings] = useState<PaymentFeeSettings>(FALLBACK_FEE_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "invoice_payments")
      .maybeSingle();
    const raw = (data?.value as Record<string, unknown> | null) ?? {};
    setSettings({
      feePercent: num(raw.platform_fee_percent, DEFAULT_INVOICE_FEE_PERCENT),
      allowWithoutConnect: raw.allow_without_connect !== false,
      noConnectExtraPercent: num(raw.no_connect_extra_percent, 0),
      noConnectFixedFee: num(raw.no_connect_fixed_fee, 0),
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...settings, settings, loading, reload: load };
}
