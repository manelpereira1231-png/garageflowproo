import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
];

export default function LanguageDropdown({
  variant = "ghost",
  size = "sm",
  showLabel = true,
}: {
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
}) {
  const { language, setLanguage } = useLanguage();
  // INDIA: only English + Hindi (no Portuguese / Spanish).
  const country = typeof window !== "undefined" ? localStorage.getItem("garageflow_country") : null;
  const visibleLangs = country === "IN"
    ? LANGS.filter((l) => l.code === "en" || l.code === "hi")
    : LANGS;
  const current = visibleLangs.find((l) => l.code === language) ?? LANGS.find((l) => l.code === language) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5" aria-label="Change language">
          <Globe className="h-4 w-4" />
          {showLabel && <span className="text-xs font-semibold uppercase">{current.code === "pt-BR" ? "BR" : current.code.toUpperCase()}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-[180px] !bg-popover !opacity-100 backdrop-blur-none shadow-xl border border-border z-[100]"
      >
        {visibleLangs.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className="cursor-pointer flex items-center gap-2"
          >
            <span className="text-base leading-none">{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === language && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
