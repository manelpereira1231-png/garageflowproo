import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageContext";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={(() => { const v = t("common.toggleTheme"); return v && !v.includes(".") ? v : "Toggle theme"; })()}
      className={`h-9 w-9 ${className}`}
      title={(() => { const v = t(isDark ? "common.lightMode" : "common.darkMode"); return v && !v.includes(".") ? v : (isDark ? "Light mode" : "Dark mode"); })()}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
