import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, BellOff, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  make: string;
  model: string;
  maxPrice?: number;
}

export default function MarketAlertSubscribe({ make, model, maxPrice }: Props) {
  const [user, setUser] = useState<any>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("listing_alerts")
          .select("id")
          .eq("user_id", user.id)
          .eq("make", make)
          .eq("model", model)
          .eq("active", true)
          .maybeSingle();
        setExists(!!data);
      }
      setLoading(false);
    })();
  }, [make, model]);

  const subscribe = async () => {
    if (!user) {
      toast.info("Inicie sessão para receber alertas");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("listing_alerts").insert({
        user_id: user.id,
        email: user.email,
        make,
        model,
        max_price: maxPrice || null,
        active: true,
      });
      if (error) throw error;
      setExists(true);
      toast.success("Alerta criado. Receberá emails quando aparecerem novos carros.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar alerta");
    } finally {
      setSaving(false);
    }
  };

  const unsubscribe = async () => {
    setSaving(true);
    try {
      await supabase.from("listing_alerts").update({ active: false })
        .eq("user_id", user.id).eq("make", make).eq("model", model);
      setExists(false);
      toast.success("Alerta desativado");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10">
      <CardContent className="pt-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
          {exists ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Bell className="h-4 w-4 text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {exists ? "Está a receber alertas" : "Avise-me de novos anúncios"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {make} {model}{maxPrice ? ` até ${formatMarketPrice(maxPrice)}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant={exists ? "outline" : "default"}
          onClick={exists ? unsubscribe : subscribe}
          disabled={saving}
          className={exists ? "" : "bg-amber-500 hover:bg-amber-400 text-slate-900"}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : exists ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        </Button>
      </CardContent>
    </Card>
  );
}
