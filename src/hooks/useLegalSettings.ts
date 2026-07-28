/**
 * useLegalSettings — reads the singleton `legal_settings` row so the footer
 * and legal pages render whatever the admin configured in
 * /admin/legal-settings, with no fake defaults hardcoded in components.
 *
 * If no legal_settings row exists OR all business-identity fields are empty
 * we return `isConfigured = false` so consumers can render the minimal
 * "GarageFlow · contact@garageflow.pt · dev disclaimer" placeholder instead
 * of leaking made-up NIF / address / capital / certifications.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LegalSettings = {
  company_name: string | null;
  trade_name: string | null;
  tax_id: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  share_capital: string | null;
  at_certified: boolean;
  at_certificate_number: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
  footer_text: string | null;
  copyright_text: string | null;
  social_links: Record<string, string>;
  show_in_footer: boolean;
};

const DEFAULT_EMAIL = "contact@garageflow.pt";

let cache: LegalSettings | null = null;
let inflight: Promise<LegalSettings | null> | null = null;
const listeners = new Set<(v: LegalSettings | null) => void>();

async function load(): Promise<LegalSettings | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("legal_settings" as any)
      .select("*")
      .maybeSingle();
    cache = (data as any) ?? null;
    listeners.forEach((cb) => cb(cache));
    return cache;
  })();
  try { return await inflight; } finally { inflight = null; }
}

export function isLegalConfigured(s: LegalSettings | null): boolean {
  if (!s) return false;
  // Considered configured only when at least a company name AND (tax id OR address) exist.
  return !!(s.company_name && (s.tax_id || s.address));
}

export function useLegalSettings() {
  const [settings, setSettings] = useState<LegalSettings | null>(cache);
  const [loaded, setLoaded] = useState<boolean>(cache !== null);

  useEffect(() => {
    const cb = (v: LegalSettings | null) => { setSettings(v); setLoaded(true); };
    listeners.add(cb);
    if (cache === null) void load().then(() => setLoaded(true));
    else setLoaded(true);
    const ch = supabase
      .channel("legal_settings_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "legal_settings" }, () => {
        cache = null;
        void load();
      })
      .subscribe();
    return () => {
      listeners.delete(cb);
      void supabase.removeChannel(ch);
    };
  }, []);

  return {
    settings,
    loaded,
    isConfigured: isLegalConfigured(settings),
    contactEmail: settings?.contact_email || DEFAULT_EMAIL,
    showInFooter: settings?.show_in_footer !== false,
  };
}
