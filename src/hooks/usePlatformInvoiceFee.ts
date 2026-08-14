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
 * Cache de módulo: esta configuração é global (não depende da oficina) e era
 * lida a cada montagem do hook, gerando dezenas de milhares de pedidos.
 * TTL curto + invalidação por evento mantêm-na fresca.
 */
let feeCache: { value: PaymentFeeSettings; at: number } | null = null;
let feeInflight: Promise<PaymentFeeSettings> | null = null;
const FEE_TTL_MS = 5 * 60 * 1000;

if (typeof window !== "undefined") {
  window.addEventListener("garageflow:platform-settings-updated", () => {
    feeCache = null;
    feeInflight = null;
  });
}

async function fetchFeeSettings(force: boolean): Promise<PaymentFeeSettings> {
  if (!force && feeCache && Date.now() - feeCache.at < FEE_TTL_MS) return feeCache.value;
  if (!force && feeInflight) return feeInflight;
  feeInflight = (async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "invoice_payments")
        .maybeSingle();
      const raw = (data?.value as Record<string, unknown> | null) ?? {};
      const value: PaymentFeeSettings = {
        feePercent: num(raw.platform_fee_percent, DEFAULT_INVOICE_FEE_PERCENT),
        allowWithoutConnect: raw.allow_without_connect !== false,
        noConnectExtraPercent: num(raw.no_connect_extra_percent, 0),
        noConnectFixedFee: num(raw.no_connect_fixed_fee, 0),
      };
      feeCache = { value, at: Date.now() };
      return value;
    } catch {
      return feeCache?.value ?? FALLBACK_FEE_SETTINGS;
    } finally {
      feeInflight = null;
    }
  })();
  return feeInflight;
}

/**
 * Configuração global de comissões dos pagamentos online de faturas.
 * Fonte única de verdade: `platform_settings.invoice_payments`
 * (editável apenas pelo Super Admin em /admin/payment-fees).
 */
export function usePlatformInvoiceFee() {
  const [settings, setSettings] = useState<PaymentFeeSettings>(
    () => feeCache?.value ?? FALLBACK_FEE_SETTINGS,
  );
  const [loading, setLoading] = useState(!feeCache);

  const load = useCallback(async (force = false) => {
    if (!feeCache) setLoading(true);
    const value = await fetchFeeSettings(force);
    setSettings(value);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...settings, settings, loading, reload: () => load(true) };
}

