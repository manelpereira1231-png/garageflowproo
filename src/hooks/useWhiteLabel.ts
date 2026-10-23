import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { SHOP_CONTEXT_EVENT } from "@/lib/shopContextSync";

interface WhiteLabelConfig {
  primaryColor: string | null;
  logoUrl: string | null;
  shopName: string;
}

/**
 * Applies white-label theming per shop.
 * Reads primary_color from shop settings (stored in shops table future column or localStorage).
 * Falls back to default GarageFlow branding.
 */
export function useWhiteLabel() {
  const activeId = useActiveShopId();
  const [revision, setRevision] = useState(0);
  const [config, setConfig] = useState<WhiteLabelConfig>({ primaryColor: null, logoUrl: null, shopName: "GarageFlow" });

  useEffect(() => {
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener(SHOP_CONTEXT_EVENT, refresh);
    return () => window.removeEventListener(SHOP_CONTEXT_EVENT, refresh);
  }, []);
  useEffect(() => {
    let alive = true;
    setConfig({ primaryColor: null, logoUrl: null, shopName: "GarageFlow" });
    const load = async () => {
      if (!activeId) return;
      const { data } = await supabase.from("shops").select("name, logo_url, primary_color").eq("id", activeId).maybeSingle();
      if (data && alive) {
        setConfig({
          primaryColor: (data as any).primary_color || null,
          logoUrl: data.logo_url,
          shopName: data.name || "GarageFlow",
        });
      }
    };
    load();
    return () => { alive = false; };
  }, [activeId, revision]);

  // Apply CSS custom property override if shop has custom color
  useEffect(() => {
    if (config.primaryColor) {
      document.documentElement.style.setProperty("--primary", config.primaryColor);
    }
    return () => {
      document.documentElement.style.removeProperty("--primary");
    };
  }, [config.primaryColor]);

  return config;
}
