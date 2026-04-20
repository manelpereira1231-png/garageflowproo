import { Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useAppMode } from "@/hooks/useOnboardingStatus";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

interface AppModeToggleProps {
  className?: string;
  compact?: boolean;
}

/**
 * Lite / Pro toggle — Binance/Coinbase-style segmented switch.
 * Always visible in the topbar so users can flip the entire UI density on demand.
 */
export default function AppModeToggle({ className, compact = false }: AppModeToggleProps) {
  const { mode, setMode } = useAppMode();
  const { t } = useLanguage();

  const liteLabel = t("appMode.lite") === "appMode.lite" ? "Lite" : t("appMode.lite");
  const proLabel = t("appMode.pro") === "appMode.pro" ? "Pro" : t("appMode.pro");

  return (
    <div
      role="group"
      aria-label={t("appMode.toggleAria") === "appMode.toggleAria" ? "Alternar modo da aplicação" : t("appMode.toggleAria")}
      className={cn(
        "relative inline-flex items-center rounded-full border border-border bg-muted/60 p-0.5 select-none",
        compact ? "h-7" : "h-8",
        className,
      )}
    >
      {/* Active pill */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={cn(
          "absolute top-0.5 bottom-0.5 rounded-full shadow-sm",
          mode === "lite" ? "left-0.5 bg-primary" : "right-0.5 bg-primary",
        )}
        style={{ width: "calc(50% - 2px)" }}
      />

      <button
        type="button"
        onClick={() => setMode("lite")}
        aria-pressed={mode === "lite"}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
          compact ? "h-6" : "h-7",
          mode === "lite" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sparkles className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
        {liteLabel}
      </button>

      <button
        type="button"
        onClick={() => setMode("pro")}
        aria-pressed={mode === "pro"}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
          compact ? "h-6" : "h-7",
          mode === "pro" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Zap className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
        {proLabel}
      </button>
    </div>
  );
}
