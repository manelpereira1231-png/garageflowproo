import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Rocket, TrendingUp, Globe, Activity } from "lucide-react";

// Fonte única de Marketing — absorve páginas legadas como tabs.
// Rotas antigas continuam acessíveis por URL (backwards compatible).
const AdminMarketing = lazy(() => import("./AdminMarketing"));
const AdminMarketingAutopilot = lazy(() => import("./AdminMarketingAutopilot"));
const AdminGrowth = lazy(() => import("./AdminGrowth"));
const AdminGrowthOpportunities = lazy(() => import("./AdminGrowthOpportunities"));
const AdminTraffic = lazy(() => import("./AdminTraffic"));
const AdminFeatureAdoption = lazy(() => import("./AdminFeatureAdoption"));

const TABS = [
  { value: "campaigns", label: "Campanhas", icon: Megaphone, Component: AdminMarketing },
  { value: "autopilot", label: "Autopiloto", icon: Rocket, Component: AdminMarketingAutopilot },
  { value: "growth", label: "Oportunidades", icon: TrendingUp, Component: AdminGrowthOpportunities },
  { value: "growth-legacy", label: "Growth Legacy", icon: TrendingUp, Component: AdminGrowth },
  { value: "traffic", label: "Aquisição (Tráfego)", icon: Globe, Component: AdminTraffic },
  { value: "adoption", label: "Adoção", icon: Activity, Component: AdminFeatureAdoption },
] as const;

const Fallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function AdminMarketingHub() {
  const [params, setParams] = useSearchParams();
  const active = useMemo(() => {
    const t = params.get("tab") || "campaigns";
    return TABS.some((x) => x.value === t) ? t : "campaigns";
  }, [params]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Campanhas, automações, crescimento, tráfego e adoção — tudo num só lugar.
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-2">
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {active === value && (
              <Suspense fallback={<Fallback />}>
                <Component />
              </Suspense>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
