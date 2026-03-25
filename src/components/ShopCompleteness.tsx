import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

interface CheckItem {
  key: string;
  label: string;
  done: boolean;
}

export default function ShopCompleteness() {
  const { t } = useLanguage();
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const activeId = localStorage.getItem("garageflow_active_shop");
      if (!activeId) { setLoading(false); return; }

      const { data: shop } = await supabase
        .from("shops")
        .select("name, email, phone, address, nif, logo_url, vat_rate, labor_rate")
        .eq("id", activeId)
        .maybeSingle();

      if (!shop) { setLoading(false); return; }

      setChecks([
        { key: "name", label: t("settings.shopName"), done: !!shop.name?.trim() },
        { key: "email", label: t("settings.email"), done: !!shop.email?.trim() },
        { key: "phone", label: t("settings.phone"), done: !!shop.phone?.trim() },
        { key: "address", label: t("settings.address") || "Morada", done: !!shop.address?.trim() },
        { key: "nif", label: "NIF / VAT", done: !!shop.nif?.trim() },
        { key: "logo", label: "Logo", done: !!shop.logo_url },
      ]);
      setLoading(false);
    };
    load();
  }, [t]);

  if (loading) return null;

  const completed = checks.filter(c => c.done).length;
  const total = checks.length;
  const percentage = Math.round((completed / total) * 100);

  // Don't show if 100% complete
  if (percentage === 100) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold">{t("onboarding.completeProfile") || "Complete o perfil da oficina"}</h3>
        </div>
        <Link
          to="/settings"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          {t("nav.settings") || "Definições"}
        </Link>
      </div>

      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground">{completed}/{total} {t("onboarding.fieldsCompleted") || "campos preenchidos"}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {checks.map(check => (
          <div key={check.key} className="flex items-center gap-1.5 text-xs">
            {check.done ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0" />
            )}
            <span className={check.done ? "text-muted-foreground" : "text-foreground font-medium"}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
