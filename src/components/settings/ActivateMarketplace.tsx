import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Lets an existing workshop (ERP) enable the Marketplace on the SAME account.
 * Server-side RPC activate_marketplace_for_shop is idempotent: it creates the
 * carity_seller_profile from shop data + grants buyer/seller roles.
 */
export function ActivateMarketplace({ shopId }: { shopId: string | null }) {
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState(false);
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("carity_seller_profiles").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles" as any).select("role").eq("user_id", user.id),
      ]);
      const roleList = (roles || []).map((r: any) => r.role);
      setActive(Boolean(profile) && (roleList.includes("seller") || roleList.includes("buyer")));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void refresh(); }, [shopId]);

  const handleActivate = async () => {
    if (!shopId) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("activate_marketplace_for_shop" as any, { _shop_id: shopId });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast.success("Marketplace activado! A sua oficina já pode receber inspecções e vender.");
        await refresh();
      } else {
        throw new Error("Falha ao activar o Marketplace.");
      }
    } catch (e: any) {
      toast.error(e.message || "Não foi possível activar o Marketplace.");
    } finally {
      setWorking(false);
    }
  };

  if (checking) {
    return null;
  }

  return (
    <Card className={active ? "border-primary/30 bg-primary/5" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          GarageFlow Market
          {active && <Badge variant="outline" className="ml-auto gap-1 border-primary/40 text-primary"><CheckCircle2 className="w-3 h-3" /> Activo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {active ? (
          <>
            <p className="text-sm text-muted-foreground">
              A sua oficina está inscrita no Marketplace com <strong>a mesma conta do ERP</strong>. Pode receber pedidos de inspecção e vender viaturas ou serviços.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open("/market/dashboard", "_blank")}>
                Abrir Marketplace <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open("/market/opportunities", "_blank")}>
                Pedidos de inspecção
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Active o Marketplace para receber pedidos de inspecção e vender viaturas ou serviços — sem criar nova conta, com os mesmos dados da oficina.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Inspecções pagas por particulares e stands</li>
              <li>Página pública da oficina no Market</li>
              <li>Sincronização automática dos dados da oficina</li>
            </ul>
            <Button onClick={handleActivate} disabled={working || !shopId} size="sm">
              {working ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> A activar…</> : "Aderir ao Marketplace"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
