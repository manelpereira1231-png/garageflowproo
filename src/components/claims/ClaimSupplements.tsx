import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Send, Camera } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { authorizedTotal, isPendingSup, type Sup } from "@/lib/claimPhases";
import { uploadClaimFiles } from "./ClaimDocumentsV2";
import { createExpertLink } from "./claimShare";

const STATUS: Record<string, string> = { pending: "Pendente", no_perito: "No perito", approved: "Autorizado", partial: "Parcial", rejected: "Recusado" };

/**
 * Orçamento e autorizações: autorização inicial + adicionais (danos ocultos).
 * Reutiliza a tabela claim_supplements. O total autorizado alimenta a faturação.
 */
export function ClaimSupplements({ claim, shopId, sups, quotes, isBR, onChanged }: {
  claim: any; shopId: string; sups: Sup[]; quotes: any[]; isBR: boolean; onChanged: () => void;
}) {
  const [open, setOpen] = useState<null | "inicial" | "adicional">(null);
  const [f, setF] = useState({ description: "", amount: "", quote_id: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [decide, setDecide] = useState<Sup | null>(null);
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasInitial = sups.some((s) => s.type === "inicial");
  const T = () => (supabase as any).from("claim_supplements");

  const syncClaim = async (list: Sup[]) => {
    const total = authorizedTotal(list);
    const anyDecided = list.some((s) => s.status === "approved" || s.status === "partial");
    await supabase.from("claims").update({
      amount_approved: anyDecided ? total : claim.amount_approved,
      amount_requested: list.reduce((t, s) => t + Number(s.amount_requested || 0), 0) || claim.amount_requested,
    } as any).eq("id", claim.id);
  };

  const openNew = (type: "inicial" | "adicional") => {
    const q = quotes.find((x) => x.id === claim.quote_id);
    setF({ description: type === "inicial" ? "Orçamento inicial" : "", amount: type === "inicial" && q ? String(q.total ?? "") : "", quote_id: type === "inicial" ? (claim.quote_id || "") : "" });
    setFiles([]); setOpen(type);
  };

  const save = async () => {
    const a = Number(f.amount);
    if (!f.description.trim() || !(a > 0)) { toast.error("Indique a descrição e o valor."); return; }
    setBusy(true);
    const number = open === "inicial" ? 0 : Math.max(0, ...sups.filter((s) => s.type === "adicional").map((s) => s.number || 0)) + 1;
    const { error } = await T().insert({
      claim_id: claim.id, shop_id: shopId, type: open, number, description: f.description.trim(),
      amount_requested: a, quote_id: f.quote_id || null,
    });
    if (!error && files.length) await uploadClaimFiles(files, { shopId, claimId: claim.id, category: "hidden_damage" });
    if (!error) await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: shopId, kind: "note", description: open === "inicial" ? `Autorização inicial pedida (${formatMoney(a)})` : `Adicional #${number} pedido: ${f.description.trim()} (${formatMoney(a)})` });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(null); onChanged();
  };

  const setDecision = async (s: Sup, status: string) => {
    let approved: number | null = null;
    if (status === "approved") approved = Number(s.amount_requested);
    if (status === "partial") {
      approved = Number(partial);
      if (!(approved > 0) || approved >= Number(s.amount_requested)) { toast.error("Indique um valor autorizado inferior ao pedido."); return; }
    }
    const { error } = await T().update({ status, amount_approved: approved, decided_at: new Date().toISOString().slice(0, 10), decided_by: "oficina" }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    const label = s.type === "inicial" ? "Autorização inicial" : `Adicional #${s.number}`;
    await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: shopId, kind: "approval", description: `${label}: ${STATUS[status]}${approved != null ? ` (${formatMoney(approved)})` : ""}` });
    await syncClaim(sups.map((x) => (x.id === s.id ? { ...x, status, amount_approved: approved } : x)));
    setDecide(null); setPartial(""); onChanged();
  };

  const sendToExpert = async (s: Sup) => {
    const r = await createExpertLink(claim, shopId, s.id);
    if (r) { await T().update({ status: "no_perito" }).eq("id", s.id); onChanged(); }
  };

  const totalReq = sups.reduce((t, s) => t + Number(s.amount_requested || 0), 0);
  const totalAuth = authorizedTotal(sups);
  const qNum = (id: string | null | undefined) => quotes.find((q) => q.id === id)?.number;

  return (
    <Card className="rounded-[14px]">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Orçamento e autorizações</CardTitle>
        <div className="flex gap-2">
          {!hasInitial && <Button variant="outline" className="min-h-[44px]" onClick={() => openNew("inicial")}>Registar orçamento inicial</Button>}
          <Button className="min-h-[44px]" onClick={() => openNew("adicional")}><Plus className="h-4 w-4 mr-1" />Pedir adicional</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Registe o orçamento inicial enviado à seguradora. Os danos encontrados depois entram como adicionais.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Pedido</th><th className="py-2 px-2 font-medium text-right">Valor pedido</th>
                <th className="py-2 px-2 font-medium text-right">Valor autorizado</th><th className="py-2 pl-2 font-medium">Estado</th>
              </tr></thead>
              <tbody>
                {[...sups].sort((a, b) => (a.type === "inicial" ? -1 : b.type === "inicial" ? 1 : (a.number || 0) - (b.number || 0))).map((s) => (
                  <tr key={s.id} className={`border-t border-border ${isPendingSup(s) ? "bg-amber-500/10" : ""}`}>
                    <td className="py-2 pr-2">
                      <p className="font-medium">{s.type === "inicial" ? "Orçamento inicial" : `Adicional #${s.number ?? ""}`}{qNum((s as any).quote_id) ? ` · ${qNum((s as any).quote_id)}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{formatMoney(Number(s.amount_requested))}</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{s.amount_approved != null ? formatMoney(Number(s.amount_approved)) : "—"}</td>
                    <td className="py-2 pl-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={s.status === "rejected" ? "destructive" : isPendingSup(s) ? "outline" : "secondary"} className={s.status === "no_perito" ? "border-amber-500 text-amber-600 dark:text-amber-400" : ""}>{STATUS[s.status] || s.status}</Badge>
                        {isPendingSup(s) && (
                          <>
                            {s.status === "pending" && <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => sendToExpert(s)}><Send className="h-4 w-4 mr-1" />Perito</Button>}
                            <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => { setDecide(s); setPartial(""); }}>Registar decisão</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-2">Total</td>
                  <td className="py-2 px-2 text-right">{formatMoney(totalReq)}</td>
                  <td className="py-2 px-2 text-right">{formatMoney(totalAuth)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">O valor autorizado total é a soma das autorizações aprovadas e alimenta a {isBR ? "nota fiscal" : "faturação"}.</p>
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && !busy && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{open === "inicial" ? "Orçamento inicial" : "Pedir adicional"}</DialogTitle>
            <DialogDescription>{open === "inicial" ? "Valor enviado à seguradora para autorização." : "Danos encontrados durante a reparação que precisam de nova autorização."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input className="min-h-[44px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: suporte do para-choques partido" /></div>
            <div><Label>Valor ({isBR ? "R$" : "€"})</Label><Input className="min-h-[44px]" type="number" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label>Orçamento associado (opcional)</Label>
              <Select value={f.quote_id || "none"} onValueChange={(v) => setF({ ...f, quote_id: v === "none" ? "" : v })}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{quotes.map((q) => <SelectItem key={q.id} value={q.id}>{q.number} — {formatMoney(Number(q.total))}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {open === "adicional" && (
              <div>
                <Button type="button" variant="outline" className="min-h-[44px] w-full" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4 mr-2" />{files.length ? `${files.length} fotografia(s)` : "Adicionar fotografias dos danos"}</Button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { setFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
                <p className="text-xs text-muted-foreground mt-1">Ficam em Documentos, na categoria "Danos ocultos".</p>
              </div>
            )}
          </div>
          <DialogFooter><Button className="min-h-[44px]" disabled={busy} onClick={save}>{busy ? "A guardar…" : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decide} onOpenChange={(o) => !o && setDecide(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decisão da seguradora</DialogTitle>
            <DialogDescription>{decide?.type === "inicial" ? "Orçamento inicial" : `Adicional #${decide?.number}`} · pedido {decide ? formatMoney(Number(decide.amount_requested)) : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button className="w-full min-h-[44px]" onClick={() => decide && setDecision(decide, "approved")}>Autorizado na totalidade</Button>
            <div className="flex gap-2">
              <Input className="min-h-[44px]" type="number" step="0.01" inputMode="decimal" placeholder="Valor autorizado" value={partial} onChange={(e) => setPartial(e.target.value)} />
              <Button variant="outline" className="min-h-[44px]" onClick={() => decide && setDecision(decide, "partial")}>Parcial</Button>
            </div>
            <Button variant="outline" className="w-full min-h-[44px] border-destructive text-destructive" onClick={() => decide && setDecision(decide, "rejected")}>Recusado</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

