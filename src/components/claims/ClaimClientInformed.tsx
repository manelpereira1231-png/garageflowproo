import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { clientMessageForPhase, computeRepairPhase, computeTotalLossPhase, isPendingSup } from "@/lib/claimPhases";
import { getClientLink } from "./claimShare";

export const waPhone = (phone: string | null | undefined, isBR: boolean) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (!isBR && d.length === 9) d = `351${d}`;
  if (isBR && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d.length >= 11 ? d : null;
};

/** Envia a mensagem ao cliente por email (envio existente do GarageFlow) e regista. */
export async function sendClientEmail(claim: any, shopId: string, message: string, link: string | null, isBR: boolean) {
  const email = claim.clients?.email;
  if (!email) return false;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      to: email, branded: true, shop_id: shopId,
      subject: `Ponto de situação ${isBR ? "do seu veículo" : "da sua viatura"}${claim.vehicles?.plate ? ` ${claim.vehicles.plate}` : ""}`,
      html: `<p>${esc(message)}</p>`,
      ...(link ? { cta: { label: "Acompanhar o processo", url: link } } : {}),
    },
  });
  if (error || !data?.success || data.simulated) return false;
  await supabase.from("claim_communications").insert({
    shop_id: shopId, claim_id: claim.id, kind: "email", direction: "out", status: "sent",
    occurred_at: new Date().toISOString(), contact_label: email, subject: "Ponto de situação ao cliente", body: message,
  } as any);
  return true;
}

export function ClaimClientInformed({ claim, shopId, isBR, onSaved }: { claim: any; shopId: string; isBR: boolean; onSaved: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const loc = isBR ? "pt-BR" : "pt-PT";
  const phone = waPhone(claim.clients?.phone, isBR);
  const sups = claim.claim_supplements || [];
  const phase = claim.outcome === "perda_total" || claim.total_loss ? computeTotalLossPhase(claim) : computeRepairPhase(claim, { sups });
  const text = msg.trim() || claim.last_client_message || clientMessageForPhase(phase, isBR, sups.some(isPendingSup));

  const record = async (channel: string, body: string) => {
    await supabase.from("claims").update({ client_informed_at: new Date().toISOString(), client_informed_note: channel, last_client_message: body, last_client_message_at: new Date().toISOString() } as any).eq("id", claim.id);
    await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: shopId, kind: "note", description: `Cliente informado (${channel}): ${body}` });
    setMsg(""); onSaved();
  };
  const viaEmail = async () => {
    if (!text) { toast.error("Escreva a mensagem."); return; }
    setBusy(true);
    const link = await getClientLink(claim, shopId);
    const ok = await sendClientEmail(claim, shopId, text, link, isBR);
    setBusy(false);
    if (!ok) { toast.error(claim.clients?.email ? "Não foi possível enviar o email." : "O cliente não tem email."); return; }
    toast.success("Email enviado ao cliente"); record("email", text);
  };
  const viaWhatsApp = async () => {
    if (!text || !phone) return;
    const link = await getClientLink(claim, shopId);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(`${text}${link ? `\n\nAcompanhe aqui: ${link}` : ""}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    await supabase.from("claim_communications").insert({ claim_id: claim.id, shop_id: shopId, kind: "whatsapp", direction: "out", status: "prepared", contact_label: phone, body: text, occurred_at: new Date().toISOString() } as any);
    toast.message("Mensagem preparada no WhatsApp");
  };
  const copyLink = async () => {
    const link = await getClientLink(claim, shopId);
    if (link) { try { await navigator.clipboard.writeText(link); toast.success("Link copiado"); } catch { toast.message(link); } }
  };

  return (
    <Card className="rounded-[14px]">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Cliente informado</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="auto-notify" className="text-sm">Automático</Label>
          <Switch id="auto-notify" checked={!!claim.auto_notify_client} onCheckedChange={async (v) => {
            const { error } = await supabase.from("claims").update({ auto_notify_client: v } as any).eq("id", claim.id);
            if (error) toast.error(error.message); else onSaved();
          }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {claim.last_client_message ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p>"{claim.last_client_message}"</p>
            <p className="mt-1 text-xs text-muted-foreground">{claim.last_client_message_at ? new Date(claim.last_client_message_at).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}{claim.client_informed_note ? ` · ${claim.client_informed_note}` : ""}</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">Ainda não foi enviada nenhuma mensagem ao cliente.</p>}
        <Textarea rows={2} placeholder="Escrever nova mensagem (opcional)" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <div className="grid grid-cols-1 gap-2">
          <Button className="min-h-[44px]" disabled={busy || !text || !claim.clients?.email} onClick={viaEmail}><Mail className="h-4 w-4 mr-2" />Enviar por email</Button>
          <Button variant="outline" className="min-h-[44px]" disabled={!text || !phone} onClick={viaWhatsApp}><MessageCircle className="h-4 w-4 mr-2" />Enviar por WhatsApp</Button>
          <Button variant="ghost" className="min-h-[44px]" onClick={copyLink}><Link2 className="h-4 w-4 mr-2" />Copiar link de acompanhamento</Button>
        </div>
        <p className="text-xs text-muted-foreground">Com "Automático" ligado, cada mudança de fase envia uma mensagem por email{claim.clients?.email ? "" : " (o cliente não tem email registado)"} e prepara-a aqui para o WhatsApp.</p>
      </CardContent>
    </Card>
  );
}
