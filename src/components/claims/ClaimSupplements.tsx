import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

type Sup = { id: string; description: string; amount_requested: number; amount_approved: number | null; status: string; requested_at: string; decided_at: string | null; billing_line_id: string | null };
const LABEL: Record<string, string> = { pending: "Aguarda resposta", approved: "Autorizado", partial: "Autorizado parcialmente", rejected: "Recusado" };

/** Adicionais (danos ocultos) pedidos à seguradora durante a reparação. */
export function ClaimSupplements({ claimId, shopId, isBR }: { claimId: string; shopId: string; isBR: boolean }) {
  const [rows, setRows] = useState<Sup[]>([]);
  const [d, setD] = useState({ description: "", amount: "" });
  const [partial, setPartial] = useState<Record<string, string>>({});
  const loc = isBR ? "pt-BR" : "pt-PT";
  const T = (q: any) => (supabase as any).from("claim_supplements");

  const load = async () => {
    const { data } = await T(0).select("*").eq("claim_id", claimId).order("created_at");
    setRows(data || []);
  };
  useEffect(() => { void load(); }, [claimId]);

  const add = async () => {
    const a = Number(d.amount);
    if (!d.description.trim() || !(a > 0)) { toast.error("Indique a descrição e o valor pedido."); return; }
    const { error } = await T(0).insert({ claim_id: claimId, shop_id: shopId, description: d.description.trim(), amount_requested: a });
    if (error) { toast.error(error.message); return; }
    setD({ description: "", amount: "" }); load();
  };
  const decide = async (s: Sup, status: string) => {
    let approved: number | null = null;
    if (status === "approved") approved = Number(s.amount_requested);
    if (status === "partial") {
      approved = Number(partial[s.id]);
      if (!(approved > 0) || approved >= Number(s.amount_requested)) { toast.error("Indique um valor autorizado inferior ao pedido."); return; }
    }
    const { error } = await T(0).update({ status, amount_approved: approved, decided_at: status === "pending" ? null : new Date().toISOString().slice(0, 10) }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  };
  const toBilling = async (s: Sup) => {
    const { data, error } = await (supabase as any).from("claim_billing_lines")
      .insert({ claim_id: claimId, shop_id: shopId, description: `Adicional: ${s.description}`, quantity: 1, unit_price: s.amount_approved, payer: "insurer" }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await T(0).update({ billing_line_id: data.id }).eq("id", s.id);
    toast.success(isBR ? "Adicionado aos itens da nota fiscal" : "Adicionado às linhas a faturar");
    load();
  };
  const remove = async (id: string) => { const { error } = await T(0).delete().eq("id", id); if (error) toast.error(error.message); else load(); };

  const sum = (f: (s: Sup) => number) => rows.reduce((t, s) => t + f(s), 0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Adicionais (danos ocultos)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Sem adicionais. Registe aqui danos encontrados durante a reparação que precisam de nova autorização.</p>}
        {rows.map((s) => (
          <div key={s.id} className="rounded-md border border-border p-3 space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{s.description}</span>
              <Badge variant={s.status === "rejected" ? "destructive" : s.status === "pending" ? "outline" : "secondary"}>{LABEL[s.status]}</Badge>
            </div>
            <p className="text-muted-foreground">
              Pedido {formatMoney(Number(s.amount_requested))} em {new Date(s.requested_at).toLocaleDateString(loc)}
              {s.amount_approved != null && <> · Autorizado {formatMoney(Number(s.amount_approved))}</>}
              {s.decided_at && <> · {new Date(s.decided_at).toLocaleDateString(loc)}</>}
            </p>
            {s.status === "pending" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="min-h-[44px]" onClick={() => decide(s, "approved")}>Autorizado</Button>
                <Input className="min-h-[44px] w-32" type="number" step="0.01" inputMode="decimal" placeholder="Valor parcial" value={partial[s.id] || ""} onChange={(e) => setPartial({ ...partial, [s.id]: e.target.value })} />
                <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => decide(s, "partial")}>Parcial</Button>
                <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => decide(s, "rejected")}>Recusado</Button>
                <Button size="icon" variant="ghost" className="min-h-[44px]" aria-label="Remover" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(s.status === "approved" || s.status === "partial") && !s.billing_line_id && (
                  <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => toBilling(s)}>{isBR ? "Adicionar à nota fiscal da seguradora" : "Adicionar à faturação da seguradora"}</Button>
                )}
                {s.billing_line_id && <span className="text-xs text-muted-foreground self-center">{isBR ? "Já nos itens da nota fiscal" : "Já nas linhas a faturar"}</span>}
                {!s.billing_line_id && <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => decide(s, "pending")}>Voltar a pendente</Button>}
              </div>
            )}
          </div>
        ))}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
          <Input className="min-h-[44px]" placeholder="Descrição do dano encontrado" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <Input className="min-h-[44px]" type="number" step="0.01" inputMode="decimal" placeholder="Valor pedido" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
          <Button variant="outline" className="min-h-[44px]" onClick={add}><Plus className="h-4 w-4 mr-1" />Pedir adicional</Button>
        </div>
        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Total pedido {formatMoney(sum((s) => Number(s.amount_requested)))} · autorizado {formatMoney(sum((s) => Number(s.amount_approved || 0)))} · pendente {formatMoney(sum((s) => s.status === "pending" ? Number(s.amount_requested) : 0))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
