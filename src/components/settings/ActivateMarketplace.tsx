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
type Status = "none" | "pending" | "approved" | "rejected";

export function ActivateMarketplace({ shopId }: { shopId: string | null }) {
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<Status>("none");
  const [rejectNotes, setRejectNotes] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !shopId) return;
      const [{ data: profile }, { data: roles }, { data: req }] = await Promise.all([
        supabase.from("carity_seller_profiles").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles" as any).select("role").eq("user_id", user.id),
        supabase.from("marketplace_activation_requests" as any)
          .select("status, notes")
          .eq("shop_id", shopId)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const roleList = (roles || []).map((r: any) => r.role);
      const isApproved = Boolean(profile) && (roleList.includes("seller") || roleList.includes("buyer"));
      if (isApproved) { setStatus("approved"); return; }
      const s = (req as any)?.status as Status | undefined;
      if (s === "pending") setStatus("pending");
      else if (s === "rejected") { setStatus("rejected"); setRejectNotes((req as any)?.notes ?? null); }
      else setStatus("none");
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
      const s = (data as any)?.status;
      if (s === "pending") {
        toast.success("Pedido enviado! A sua adesão está a aguardar aprovação da equipa GarageFlow.");
      } else if (s === "approved") {
        toast.success("Marketplace já está activo para a sua oficina.");
      }
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível submeter o pedido.");
    } finally {
      setWorking(false);
    }
  };

  if (checking) return null;

  const active = status === "approved";
  const pending = status === "pending";
  const rejected = status === "rejected";

  return (
    <Card className={active ? "border-primary/30 bg-primary/5" : pending ? "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/10" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          GarageFlow Market
          {active && <Badge variant="outline" className="ml-auto gap-1 border-primary/40 text-primary"><CheckCircle2 className="w-3 h-3" /> Activo</Badge>}
          {pending && <Badge variant="outline" className="ml-auto gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"><Loader2 className="w-3 h-3 animate-spin" /> Em análise</Badge>}
          {rejected && <Badge variant="outline" className="ml-auto border-destructive/40 text-destructive">Recusado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {active ? (
          <>
            <p className="text-sm text-muted-foreground">
              A sua oficina está inscrita no Marketplace com <strong>a mesma conta do ERP</strong>. Pode receber pedidos de inspeção e vender viaturas ou serviços.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open("/market/dashboard", "_blank")}>
                Abrir Marketplace <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open("/market/opportunities", "_blank")}>
                Pedidos de inspeção
              </Button>
            </div>
          </>
        ) : pending ? (
          <p className="text-sm text-muted-foreground">
            O seu pedido de adesão ao Marketplace está a aguardar aprovação da equipa GarageFlow. Iremos notificá-lo assim que for revisto.
          </p>
        ) : (
          <>
            {rejected && (
              <div className="text-xs rounded-md border border-destructive/30 bg-destructive/5 text-destructive p-2">
                Pedido anterior recusado{rejectNotes ? `: ${rejectNotes}` : "."} Pode voltar a submeter.
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Peça adesão ao Marketplace para receber pedidos de inspeção e vender viaturas ou serviços — sem criar nova conta. O pedido é revisto pela equipa GarageFlow antes de ser ativado.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Inspeções pagas por particulares e stands</li>
              <li>Página pública da oficina no Market</li>
              <li>Aprovação manual pelo administrador comercial</li>
            </ul>
            <Button onClick={handleActivate} disabled={working || !shopId} size="sm">
              {working ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> A submeter…</> : "Pedir adesão ao Marketplace"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
