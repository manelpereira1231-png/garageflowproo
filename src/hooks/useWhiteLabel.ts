import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [config, setConfig] = useState<WhiteLabelConfig>({ primaryColor: null, logoUrl: null, shopName: "GarageFlow" });

  useEffect(() => {
    const load = async () => {
      const activeId = localStorage.getItem("garageflow_active_shop");
      if (!activeId) return;
      const { data } = await supabase.from("shops").select("name, logo_url").eq("id", activeId).maybeSingle();
      if (data) {
        setConfig({
          primaryColor: null, // Future: read from shop config
          logoUrl: data.logo_url,
          shopName: data.name || "GarageFlow",
        });
      }
    };
    load();
  }, []);

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
