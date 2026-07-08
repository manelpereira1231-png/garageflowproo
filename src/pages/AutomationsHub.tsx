import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Megaphone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import Automations from "./Automations";
import Marketing from "./Marketing";

export default function AutomationsHub() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash === "marketing" || hash === "automations") return hash;
    }
    return "automations";
  });

  const onChange = (v: string) => {
    setTab(v);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${v}`);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={onChange} className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-auto">
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="w-4 h-4" /> {t("nav.automations")}
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2">
            <Megaphone className="w-4 h-4" /> {t("nav.marketing")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="automations" className="mt-4">
          <Automations />
        </TabsContent>
        <TabsContent value="marketing" className="mt-4">
          <Marketing />
        </TabsContent>
      </Tabs>
    </div>
  );
}
