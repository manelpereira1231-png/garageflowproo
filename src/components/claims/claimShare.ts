import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generatePdf } from "@/lib/pdfGenerator";
import { clientDisplayName } from "@/lib/clientDisplayName";
import { claimVehicleLabel } from "@/lib/claimVehicle";

const origin = () => "https://garageflow.pt";

/** Link de acompanhamento do cliente (reutiliza o existente se ainda for válido). */
export async function getClientLink(claim: any, shopId: string): Promise<string | null> {
  const { data: ex } = await (supabase as any).from("claim_share_links").select("token, expires_at")
    .eq("claim_id", claim.id).eq("shop_id", shopId).eq("audience", "cliente").is("revoked_at", null).order("created_at", { ascending: false }).limit(1);
  const valid = (ex || []).find((l: any) => !l.expires_at || new Date(l.expires_at) > new Date());
  if (valid) return `${origin()}/acompanhar/${valid.token}`;
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await (supabase as any).from("claim_share_links")
    .insert({ claim_id: claim.id, shop_id: shopId, audience: "cliente", created_by: auth.session?.user.id ?? null })
    .select("token").single();
  if (error) { toast.error(error.message); return null; }
  return `${origin()}/acompanhar/${data.token}`;
}

/** Cria o link do perito (14 dias) para uma autorização e abre as opções de envio. */
export async function createExpertLink(claim: any, shopId: string, supplementId: string, delivery: "copy" | "email" = "copy"): Promise<string | null> {
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await (supabase as any).from("claim_share_links").insert({
    claim_id: claim.id, shop_id: shopId, audience: "perito", supplement_id: supplementId,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), created_by: auth.session?.user.id ?? null,
  }).select("token").single();
  if (error) { toast.error(error.message); return null; }
  const url = `${origin()}/perito/${data.token}`;
  let copied = false;
  try { await navigator.clipboard.writeText(url); copied = true; } catch { toast.message(url, { duration: 20000 }); }
  await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: shopId, kind: "note", description: "Link do perito preparado (válido 14 dias)" });
  const contact = String(claim.expert_contact || "");
  const email = contact.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
  const phone = contact.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const identity = claimVehicleLabel(claim.vehicles);
  const text = `Olá${claim.expert_name ? ` ${claim.expert_name}` : ""}, segue o pedido de validação do sinistro ${claim.ref || ""}${claim.process_number || claim.claim_number ? ` · Processo ${claim.process_number || claim.claim_number}` : ""}${identity ? `\nViatura: ${identity}` : ""}${claim.vehicles?.vin ? `\nVIN / Chassis: ${claim.vehicles.vin}` : ""}\n${url}`;
  if (email && delivery === "email") {
    try {
      const attachments: { filename: string; content: string }[] = [];
      const { data: sup } = await (supabase as any).from("claim_supplements").select("quote_id").eq("id", supplementId).eq("shop_id", shopId).single();
      if (sup?.quote_id) {
        const [{ data: quote }, { data: shop }] = await Promise.all([
          supabase.from("quotes").select("*, clients(name,company,email,phone,nif), vehicles(make,model,plate)").eq("id", sup.quote_id).eq("shop_id", shopId).single(),
          supabase.from("shops").select("*").eq("id", shopId).single(),
        ]);
        if (!quote || !shop) throw new Error("Não foi possível preparar o orçamento em anexo.");
        const q = quote as any;
        const doc = await generatePdf({ type: "quote", number: q.number, date: q.date || q.created_at.slice(0, 10), validityDate: q.validity_date,
          shopName: shop.name, shopEmail: shop.email || "", shopPhone: shop.phone || "", shopNif: shop.nif || undefined, shopAddress: shop.address || undefined,
          clientName: clientDisplayName(q.clients), clientEmail: q.clients?.email, clientPhone: q.clients?.phone, clientNif: q.clients?.nif,
          vehicleMake: claim.vehicles?.make || "", vehicleModel: [claim.vehicles?.model, claim.vehicles?.version].filter(Boolean).join(" "), vehiclePlate: claim.vehicles?.plate || "",
          lines: Array.isArray(q.lines) ? q.lines : [], subtotal: Number(q.subtotal || 0), vatTotal: Number(q.vat_total || 0), total: Number(q.total || 0), profit: Number(q.profit || 0),
          currency: shop.currency || (shop.country_code === "BR" ? "BRL" : "EUR"), notes: q.notes, laborHours: q.labor_hours, laborRate: Number(shop.labor_rate || 0),
        }, false);
        attachments.push({ filename: `${q.number}.pdf`, content: doc.output("datauristring").split(",")[1] });
      }
      const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
      const { data: sent, error: sendError } = await supabase.functions.invoke("send-email", { body: { to: email, shop_id: shopId, branded: true, subject: `Validação ${claim.ref || "sinistro"}`, html: `<p>${esc(text)}</p>`, cta: { label: "Ver pedido e registar decisão", url }, attachments } });
      if (sendError || !sent?.success || sent.simulated) throw new Error("O email não foi enviado. O link continua disponível para partilhar.");
      await supabase.from("claim_communications").insert({ claim_id: claim.id, shop_id: shopId, kind: "email", direction: "out", status: "sent", contact_label: email, subject: `Validação ${claim.ref || "sinistro"}`, body: text, occurred_at: new Date().toISOString() } as any);
      toast.success("Pacote enviado por email ao perito");
      return url;
    } catch (e: any) { toast.error(e.message || "Não foi possível enviar o email ao perito."); }
  }
  toast.success(copied ? "Link do perito copiado" : "Link do perito criado", {
    description: email ? "Pode colar no email ou usar o botão abaixo." : "Cole-o no email ou WhatsApp do perito.",
    action: email
      ? { label: "Abrir email", onClick: () => window.open(`mailto:${email}?subject=${encodeURIComponent(`Validação ${claim.ref || "sinistro"}`)}&body=${encodeURIComponent(text)}`, "_blank") }
      : phone.length >= 9
        ? { label: "WhatsApp", onClick: () => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank") }
        : undefined,
    duration: 12000,
  });
  return url;
}
