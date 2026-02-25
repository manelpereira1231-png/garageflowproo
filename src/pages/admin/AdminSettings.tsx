import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Bell, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PlanLimits {
  freePlanEnabled: boolean;
  proPlanEnabled: boolean;
  garagePlanEnabled: boolean;
  freeQuoteLimit: number;
  freeUserLimit: number;
  proUserLimit: number;
  trialDays: number;
}

interface NotificationSettings {
  autoAlerts: boolean;
  emailNotifications: boolean;
}

interface PdfSettings {
  watermarkOnFree: boolean;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits>({
    freePlanEnabled: true, proPlanEnabled: true, garagePlanEnabled: true,
    freeQuoteLimit: 10, freeUserLimit: 1, proUserLimit: 5, trialDays: 30,
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    autoAlerts: true, emailNotifications: true,
  });
  const [pdf, setPdf] = useState<PdfSettings>({ watermarkOnFree: true });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value");
      if (data) {
        data.forEach((row: any) => {
          if (row.key === "plan_limits") setPlanLimits(row.value as PlanLimits);
          if (row.key === "notifications") setNotifications(row.value as NotificationSettings);
          if (row.key === "pdf") setPdf(row.value as PdfSettings);
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
    ];
    
    let hasError = false;
    for (const u of updates) {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: u.value as any, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("key", u.key);
      if (error) hasError = true;
    }

    // Log action
    await supabase.from("audit_logs").insert([{
      action: "settings_updated",
      entity_type: "platform_settings",
      user_id: user?.id,
      details: { plan_limits: planLimits, notifications, pdf } as any,
    }]);

    setSaving(false);
    if (hasError) {
      toast({ title: "Erro", description: "Não foi possível guardar todas as configurações.", variant: "destructive" });
    } else {
      toast({ title: "Configurações guardadas", description: "As alterações foram persistidas na base de dados." });
    }
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
      <div>
        <h1 className="page-title">Configurações do Admin</h1>
        <p className="text-sm text-muted-foreground">Configurações globais do sistema GarageFlow (persistidas na base de dados)</p>
      </div>

      {/* Plan Limits */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Planos & Limites
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Plano Free</Label>
              <Switch checked={planLimits.freePlanEnabled} onCheckedChange={v => setPlanLimits(s => ({ ...s, freePlanEnabled: v }))} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Plano Pro</Label>
              <Switch checked={planLimits.proPlanEnabled} onCheckedChange={v => setPlanLimits(s => ({ ...s, proPlanEnabled: v }))} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Plano Garage</Label>
              <Switch checked={planLimits.garagePlanEnabled} onCheckedChange={v => setPlanLimits(s => ({ ...s, garagePlanEnabled: v }))} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Limite orçamentos (Free)</Label>
            <Input type="number" value={planLimits.freeQuoteLimit}
              onChange={e => setPlanLimits(s => ({ ...s, freeQuoteLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Limite utilizadores (Free)</Label>
            <Input type="number" value={planLimits.freeUserLimit}
              onChange={e => setPlanLimits(s => ({ ...s, freeUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Limite utilizadores (Pro)</Label>
            <Input type="number" value={planLimits.proUserLimit}
              onChange={e => setPlanLimits(s => ({ ...s, proUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dias de trial</Label>
            <Input type="number" value={planLimits.trialDays}
              onChange={e => setPlanLimits(s => ({ ...s, trialDays: Number(e.target.value) }))} />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Alertas & Notificações
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Alertas automáticos</Label>
              <p className="text-xs text-muted-foreground">Enviar alertas automaticamente para oficinas</p>
            </div>
            <Switch checked={notifications.autoAlerts} onCheckedChange={v => setNotifications(s => ({ ...s, autoAlerts: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações por email</Label>
              <p className="text-xs text-muted-foreground">Enviar emails de notificação para owners</p>
            </div>
            <Switch checked={notifications.emailNotifications} onCheckedChange={v => setNotifications(s => ({ ...s, emailNotifications: v }))} />
          </div>
        </div>
      </div>

      {/* PDF */}
      <div className="stat-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> PDFs
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Marca d'água no plano Free</Label>
            <p className="text-xs text-muted-foreground">Adicionar "GarageFlow" como marca d'água nos PDFs do plano Free</p>
          </div>
          <Switch checked={pdf.watermarkOnFree} onCheckedChange={v => setPdf(s => ({ ...s, watermarkOnFree: v }))} />
        </div>
      </div>

      <Button onClick={handleSave} className="gap-2" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
        {saving ? "A guardar..." : "Guardar Configurações"}
      </Button>
    </div>
  );
}
