import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Bell, FileText, Loader2, DollarSign, Zap, Building2, Users, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { notifyPlatformSettingsUpdated } from "@/lib/platformSettings";
import { usePlanNames } from "@/hooks/usePlanNames";

interface PlanLimits {
  freePlanEnabled: boolean;
  proPlanEnabled: boolean;
  garagePlanEnabled: boolean;
  freeQuoteLimit: number;
  freeUserLimit: number;
  proUserLimit: number;
  garageUserLimit: number;
  trialDays: number;
  freeMaxShops: number;
  proMaxShops: number;
  garageMaxShops: number;
}

interface PlanPricing {
  proMonthly: number;
  proAnnual: number;
  garageMonthly: number;
  garageAnnual: number;
}

interface NotificationSettings {
  autoAlerts: boolean;
  emailNotifications: boolean;
  alertFollowUpDays: number;
  alertMaxFollowUps: number;
  inactiveClientDays: number;
  reminderDaysBefore: number;
}

interface PdfSettings {
  watermarkOnFree: boolean;
}

interface FeatureGates {
  freeFeatures: string[];
  proFeatures: string[];
  garageFeatures: string[];
}

const ALL_FEATURES = [
  { key: "quotes", label: "Orçamentos" },
  { key: "work_orders", label: "Serviços" },
  { key: "clients", label: "Clientes & Veículos" },
  { key: "invoices", label: "Faturação" },
  { key: "alerts_basic", label: "Alertas Básicos" },
  { key: "alerts_advanced", label: "Alertas Avançados" },
  { key: "team", label: "Equipa" },
  { key: "chat", label: "Chat / Chatbot" },
  { key: "marketing", label: "Marketing & Campanhas" },
  { key: "loyalty", label: "Programa de Fidelidade" },
  { key: "stock", label: "Stock & Peças" },
  { key: "inspections", label: "Inspeções" },
  { key: "agenda", label: "Agenda & Booking" },
  { key: "reports_basic", label: "Relatórios Básicos" },
  { key: "reports_advanced", label: "Relatórios Avançados" },
  { key: "multi_shop", label: "Multi-oficina" },
  { key: "csv_export", label: "Exportação CSV" },
  { key: "api", label: "API & Integrações" },
  { key: "quote_approval", label: "Aprovação Online" },
  { key: "client_portal", label: "Portal do Cliente" },
  { key: "service_catalog", label: "Catálogo de Serviços" },
  { key: "automations", label: "Automações Avançadas" },
];

const DEFAULT_FREE_FEATURES = ["quotes", "work_orders", "clients", "invoices", "service_catalog"];
const DEFAULT_PRO_FEATURES = [...DEFAULT_FREE_FEATURES, "alerts_basic", "team", "agenda", "reports_basic", "csv_export", "quote_approval", "client_portal", "stock", "inspections"];
const DEFAULT_GARAGE_FEATURES = [...ALL_FEATURES.map(f => f.key)];

export default function AdminSettings() {
  const { toast } = useToast();
  const { getName: getPlanName } = usePlanNames();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits>({
    freePlanEnabled: true, proPlanEnabled: true, garagePlanEnabled: true,
    freeQuoteLimit: 10, freeUserLimit: 1, proUserLimit: 5, garageUserLimit: 999,
    trialDays: 30, freeMaxShops: 1, proMaxShops: 1, garageMaxShops: 5,
  });
  const [pricing, setPricing] = useState<PlanPricing>({
    proMonthly: 49, proAnnual: 490, garageMonthly: 99, garageAnnual: 990,
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    autoAlerts: true, emailNotifications: true,
    alertFollowUpDays: 3, alertMaxFollowUps: 3,
    inactiveClientDays: 90, reminderDaysBefore: 7,
  });
  const [pdf, setPdf] = useState<PdfSettings>({ watermarkOnFree: true });
  const [featureGates, setFeatureGates] = useState<FeatureGates>({
    freeFeatures: DEFAULT_FREE_FEATURES,
    proFeatures: DEFAULT_PRO_FEATURES,
    garageFeatures: DEFAULT_GARAGE_FEATURES,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value");
      if (data) {
        data.forEach((row: any) => {
          if (row.key === "plan_limits") setPlanLimits(prev => ({ ...prev, ...row.value }));
          if (row.key === "notifications") setNotifications(prev => ({ ...prev, ...row.value }));
          if (row.key === "pdf") setPdf(row.value as PdfSettings);
          if (row.key === "feature_gates") setFeatureGates(prev => ({ ...prev, ...row.value }));
        });
      }
      // Pricing comes from country_settings (single source of truth) — display PT defaults.
      const { data: pt } = await supabase
        .from("country_settings")
        .select("saas_pro_monthly,saas_pro_yearly,saas_garage_monthly,saas_garage_yearly")
        .eq("code", "PT")
        .maybeSingle();
      if (pt) {
        setPricing({
          proMonthly: Number(pt.saas_pro_monthly) || 0,
          proAnnual: Number(pt.saas_pro_yearly) || 0,
          garageMonthly: Number(pt.saas_garage_monthly) || 0,
          garageAnnual: Number(pt.saas_garage_yearly) || 0,
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const updates = [
      { key: "plan_limits", value: planLimits },
      { key: "notifications", value: notifications },
      { key: "pdf", value: pdf },
      { key: "feature_gates", value: featureGates },
    ];
    
    let hasError = false;
    for (const u of updates) {
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          { key: u.key, value: u.value as any, updated_at: new Date().toISOString(), updated_by: user?.id },
          { onConflict: "key" }
        );
      if (error) hasError = true;
    }

    await supabase.from("audit_logs").insert([{
      action: "settings_updated",
      entity_type: "platform_settings",
      user_id: user?.id,
      details: { plan_limits: planLimits, notifications, pdf, pricing, feature_gates: featureGates } as any,
    }]);

    setSaving(false);
    if (hasError) {
      toast({ title: "Erro", description: "Não foi possível guardar todas as configurações.", variant: "destructive" });
    } else {
      // Invalidate the platform-settings cache and push the new values to
      // every mounted hook (useSubscription, PlanGate, etc.) — no refresh
      // needed for limits/feature toggles to take effect across the app.
      notifyPlatformSettingsUpdated();
      toast({ title: "Configurações guardadas", description: "Aplicadas imediatamente em todo o GarageFlow." });
    }
  };

  const toggleFeature = (plan: 'freeFeatures' | 'proFeatures' | 'garageFeatures', feature: string) => {
    setFeatureGates(prev => {
      const current = prev[plan];
      const updated = current.includes(feature)
        ? current.filter(f => f !== feature)
        : [...current, feature];
      return { ...prev, [plan]: updated };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Configurações da Plataforma</h1>
          <p className="text-sm text-muted-foreground">Configurações globais do GarageFlow (persistidas na base de dados)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <a href="/admin/features"><Lock className="w-4 h-4" /> Matriz de Funcionalidades</a>
          </Button>
          <Button onClick={handleSave} className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            {saving ? "A guardar..." : "Guardar Tudo"}
          </Button>
        </div>
      </div>

      {/* Plan Limits */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Planos & Limites
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Plano {getPlanName('free', 'Free')}</Label>
              <Switch checked={planLimits.freePlanEnabled} onCheckedChange={v => setPlanLimits(s => ({ ...s, freePlanEnabled: v }))} />
            </div>
            <Badge variant="outline" className="bg-muted text-muted-foreground">€0/mês</Badge>
          </div>
          <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Plano {getPlanName('pro', 'Pro')}</Label>
              <Switch checked={planLimits.proPlanEnabled} onCheckedChange={v => setPlanLimits(s => ({ ...s, proPlanEnabled: v }))} />
            </div>
            <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">€{pricing.proMonthly}/mês</Badge>
          </div>
          <div className="space-y-2 p-3 rounded-lg bg-success/5 border border-success/20">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Plano {getPlanName('garage', 'Garage')}</Label>
              <Switch checked={planLimits.garagePlanEnabled} onCheckedChange={v => setPlanLimits(s => ({ ...s, garagePlanEnabled: v }))} />
            </div>
            <Badge variant="outline" className="bg-success/15 text-success border-success/30">€{pricing.garageMonthly}/mês</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Orçamentos/mês (Free)</Label>
            <Input type="number" value={planLimits.freeQuoteLimit}
              onChange={e => setPlanLimits(s => ({ ...s, freeQuoteLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Utilizadores (Free)</Label>
            <Input type="number" value={planLimits.freeUserLimit}
              onChange={e => setPlanLimits(s => ({ ...s, freeUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Utilizadores (Pro)</Label>
            <Input type="number" value={planLimits.proUserLimit}
              onChange={e => setPlanLimits(s => ({ ...s, proUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Utilizadores (Garage)</Label>
            <Input type="number" value={planLimits.garageUserLimit}
              onChange={e => setPlanLimits(s => ({ ...s, garageUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dias de trial</Label>
            <Input type="number" value={planLimits.trialDays}
              onChange={e => setPlanLimits(s => ({ ...s, trialDays: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Max oficinas (Free)</Label>
            <Input type="number" value={planLimits.freeMaxShops}
              onChange={e => setPlanLimits(s => ({ ...s, freeMaxShops: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Max oficinas (Pro)</Label>
            <Input type="number" value={planLimits.proMaxShops}
              onChange={e => setPlanLimits(s => ({ ...s, proMaxShops: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Max oficinas (Garage)</Label>
            <Input type="number" value={planLimits.garageMaxShops}
              onChange={e => setPlanLimits(s => ({ ...s, garageMaxShops: Number(e.target.value) }))} />
          </div>
        </div>
      </div>

      {/* Pricing — unified source: country_settings (managed in /admin/countries) */}
      <div className="stat-card space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Preços dos Planos
        </h2>
        <p className="text-sm text-muted-foreground">
          Os preços são geridos por país (uma única fonte de verdade) em <strong>Países & Mercados Globais</strong>.
          Alterações aplicam-se imediatamente à página de planos pública e ao checkout — sem necessidade de refresh.
          Para alterar o valor efetivamente cobrado pelo Stripe, atualiza também o <em>Stripe Price ID</em> nessa página.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/admin/countries">Gerir preços por país →</a>
        </Button>
      </div>

      {/* Feature Gates */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" /> Funcionalidades por Plano
        </h2>
        <p className="text-xs text-muted-foreground">Ativa/desativa funcionalidades para cada plano. Alterações aplicam-se imediatamente após guardar.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Funcionalidade</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Free</th>
                <th className="text-center px-3 py-2 font-medium text-primary">Pro</th>
                <th className="text-center px-3 py-2 font-medium text-success">Garage</th>
              </tr>
            </thead>
            <tbody>
              {ALL_FEATURES.map(f => (
                <tr key={f.key} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{f.label}</td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={featureGates.freeFeatures.includes(f.key)}
                      onCheckedChange={() => toggleFeature('freeFeatures', f.key)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={featureGates.proFeatures.includes(f.key)}
                      onCheckedChange={() => toggleFeature('proFeatures', f.key)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={featureGates.garageFeatures.includes(f.key)}
                      onCheckedChange={() => toggleFeature('garageFeatures', f.key)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notifications & Automations */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Alertas, Notificações & Automações
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Alertas automáticos</Label>
              <p className="text-xs text-muted-foreground">Gerar alertas automaticamente (revisões, clientes inativos, etc.)</p>
            </div>
            <Switch checked={notifications.autoAlerts} onCheckedChange={v => setNotifications(s => ({ ...s, autoAlerts: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações por email</Label>
              <p className="text-xs text-muted-foreground">Enviar emails automáticos para proprietários de oficinas</p>
            </div>
            <Switch checked={notifications.emailNotifications} onCheckedChange={v => setNotifications(s => ({ ...s, emailNotifications: v }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Seguimento a cada (dias)</Label>
            <Input type="number" value={notifications.alertFollowUpDays}
              onChange={e => setNotifications(s => ({ ...s, alertFollowUpDays: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Máximo de seguimentos</Label>
            <Input type="number" value={notifications.alertMaxFollowUps}
              onChange={e => setNotifications(s => ({ ...s, alertMaxFollowUps: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cliente inativo após (dias)</Label>
            <Input type="number" value={notifications.inactiveClientDays}
              onChange={e => setNotifications(s => ({ ...s, inactiveClientDays: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lembrete revisão (dias antes)</Label>
            <Input type="number" value={notifications.reminderDaysBefore}
              onChange={e => setNotifications(s => ({ ...s, reminderDaysBefore: Number(e.target.value) }))} />
          </div>
        </div>
      </div>

      {/* PDF */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> PDFs & Documentos
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Marca d'água "GarageFlow" no plano Free</Label>
            <p className="text-xs text-muted-foreground">PDFs do plano Free incluem marca d'água com a marca GarageFlow</p>
          </div>
          <Switch checked={pdf.watermarkOnFree} onCheckedChange={v => setPdf(s => ({ ...s, watermarkOnFree: v }))} />
        </div>
      </div>

      {/* System Info */}
      <div className="stat-card space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Informação do Sistema
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Funções Backend</p>
            <p className="font-medium">9 ativas</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">send-email, check-reminders, generate-alerts, expire-trials, create-checkout, check-subscription, customer-portal, admin-confirm-email, stripe-webhook</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Realtime</p>
            <p className="font-medium">4 tabelas ativas</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">shops, subscriptions, chat_messages, alerts</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Armazenamento</p>
            <p className="font-medium">2 buckets</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">shop-logos (público), work-order-files (privado), inspection-files (privado)</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} className="gap-2" size="lg" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
          {saving ? "A guardar..." : "Guardar Todas as Configurações"}
        </Button>
      </div>
    </div>
  );
}
