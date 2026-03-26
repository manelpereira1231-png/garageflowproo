import { Bell, BellOff, BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { t } = useLanguage();

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("pushNotSupported") || "Notificações push não suportadas"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("pushNotSupportedDesc") || "O seu browser não suporta notificações push."}
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) toast.success(t("pushDisabled") || "Notificações desativadas");
    } else {
      const ok = await subscribe();
      if (ok) {
        toast.success(t("pushEnabled") || "Notificações ativadas!");
      } else if (permission === "denied") {
        toast.error(t("pushDenied") || "Permissão negada. Ative nas definições do browser.");
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <BellRing className="h-5 w-5 text-primary" />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <Label className="text-sm font-medium cursor-pointer">
            {t("pushNotifications") || "Notificações Push"}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("pushDescription") || "Receba alertas de novas OS, faturas e inspeções."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSubscribed && (
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            {t("active") || "Ativo"}
          </Badge>
        )}
        <Switch
          checked={isSubscribed}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
