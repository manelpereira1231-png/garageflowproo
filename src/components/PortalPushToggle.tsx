import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const VAPID_PUBLIC_KEY = "BFAYjprf22v5YveYwXlUZBBUCJoZ6GtFvoq6vzdtcVLFNJKxSoYig8KgiYzh93Nrc2OdlZ6NItLNqg2qE4xRMdQ";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PortalPushToggleProps {
  shopId: string;
  clientId: string;
  labels: {
    pushNotifications: string;
    pushDescription: string;
    pushNotSupported: string;
    active: string;
  };
}

/**
 * Push notification toggle for the Client Portal.
 * Does NOT require Supabase auth — stores subscription keyed by clientId.
 */
export function PortalPushToggle({ shopId, clientId, labels }: PortalPushToggleProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExisting();
    } else {
      setIsLoading(false);
    }
  }, []);

  const checkExisting = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setIsLoading(false); return false; }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });

      const json = subscription.toJSON();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      if (!projectId) throw new Error("Missing project config");

      // Save via edge function (no auth needed — uses clientId)
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "subscribe",
            shop_id: shopId,
            client_id: clientId,
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          }),
        }
      );

      if (!resp.ok) throw new Error("Subscription failed");
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Portal push subscribe error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, shopId, clientId]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("Portal push unsubscribe error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <BellOff className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{labels.pushNotSupported}</p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <BellOff className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{labels.pushNotSupported}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2.5">
        {isSubscribed ? (
          <BellRing className="h-4 w-4 text-primary" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">{labels.pushNotifications}</p>
          <p className="text-xs text-muted-foreground">{labels.pushDescription}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSubscribed && (
          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
            {labels.active}
          </Badge>
        )}
        <Switch
          checked={isSubscribed}
          onCheckedChange={() => isSubscribed ? unsubscribe() : subscribe()}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
