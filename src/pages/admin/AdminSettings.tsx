import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Bell, FileText } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    freePlanEnabled: true,
    proPlanEnabled: true,
    garagePlanEnabled: true,
    freeQuoteLimit: 10,
    freeUserLimit: 1,
    proUserLimit: 5,
    trialDays: 30,
    autoAlerts: true,
    emailNotifications: true,
    watermarkOnFree: true,
  });

  const handleSave = () => {
    // In production this would persist to DB
    toast({ title: "Configurações guardadas", description: "As alterações foram aplicadas." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Configurações do Admin</h1>
        <p className="text-sm text-muted-foreground">Configurações globais do sistema GarageFlow</p>
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
              <Switch checked={settings.freePlanEnabled} onCheckedChange={v => setSettings(s => ({ ...s, freePlanEnabled: v }))} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Plano Pro</Label>
              <Switch checked={settings.proPlanEnabled} onCheckedChange={v => setSettings(s => ({ ...s, proPlanEnabled: v }))} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Plano Garage</Label>
              <Switch checked={settings.garagePlanEnabled} onCheckedChange={v => setSettings(s => ({ ...s, garagePlanEnabled: v }))} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Limite orçamentos (Free)</Label>
            <Input type="number" value={settings.freeQuoteLimit}
              onChange={e => setSettings(s => ({ ...s, freeQuoteLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Limite utilizadores (Free)</Label>
            <Input type="number" value={settings.freeUserLimit}
              onChange={e => setSettings(s => ({ ...s, freeUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Limite utilizadores (Pro)</Label>
            <Input type="number" value={settings.proUserLimit}
              onChange={e => setSettings(s => ({ ...s, proUserLimit: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dias de trial</Label>
            <Input type="number" value={settings.trialDays}
              onChange={e => setSettings(s => ({ ...s, trialDays: Number(e.target.value) }))} />
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
            <Switch checked={settings.autoAlerts} onCheckedChange={v => setSettings(s => ({ ...s, autoAlerts: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações por email</Label>
              <p className="text-xs text-muted-foreground">Enviar emails de notificação para owners</p>
            </div>
            <Switch checked={settings.emailNotifications} onCheckedChange={v => setSettings(s => ({ ...s, emailNotifications: v }))} />
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
          <Switch checked={settings.watermarkOnFree} onCheckedChange={v => setSettings(s => ({ ...s, watermarkOnFree: v }))} />
        </div>
      </div>

      <Button onClick={handleSave} className="gap-2">
        <Settings className="w-4 h-4" /> Guardar Configurações
      </Button>
    </div>
  );
}
