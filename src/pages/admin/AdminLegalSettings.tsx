/**
 * AdminLegalSettings — edits the singleton `legal_settings` row that feeds
 * LegalFooter and the marketing footer. When all business-identity fields
 * are blank, the site auto-renders the "GarageFlow · contact@garageflow.pt"
 * minimal footer instead of leaking fake NIF / address.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

type Row = Record<string, any>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NIF_RE = /^[A-Z0-9-]{4,32}$/i; // permissive: multi-country tax IDs

export default function AdminLegalSettings() {
  const { toast } = useToast();
  const [row, setRow] = useState<Row>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("legal_settings" as any).select("*").maybeSingle();
      setRow((data as any) || { contact_email: "contact@garageflow.pt", at_certified: false, show_in_footer: true, social_links: {} });
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: any) => setRow((r) => ({ ...r, [k]: v }));

  async function save() {
    // Validation
    if (row.contact_email && !EMAIL_RE.test(row.contact_email)) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    if (row.tax_id && !NIF_RE.test(row.tax_id)) {
      toast({ title: "NIF inválido", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { ...row, singleton: true };
    const { error } = await supabase
      .from("legal_settings" as any)
      .upsert(payload, { onConflict: "singleton" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Guardado. O rodapé atualiza automaticamente." });
  }

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const F = (label: string, k: string, type: string = "text", placeholder = "") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={row[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Informações Legais</h1>
        <p className="text-sm text-muted-foreground">
          Dados legais exibidos no rodapé do site e nas páginas legais. Se ficarem vazios, o rodapé mostra apenas <b>GarageFlow · contact@garageflow.pt</b> com aviso de versão em desenvolvimento.
        </p>
      </div>

      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold">Identidade da empresa</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {F("Nome da empresa", "company_name")}
          {F("Nome comercial", "trade_name")}
          {F("NIF / Tax ID", "tax_id")}
          {F("Capital Social (opcional)", "share_capital")}
        </div>
      </section>

      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold">Morada</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {F("Morada", "address")}
          {F("Código Postal", "postal_code")}
          {F("Cidade", "city")}
          {F("País", "country")}
        </div>
      </section>

      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold">Contactos</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {F("Email de contacto", "contact_email", "email", "contact@garageflow.pt")}
          {F("Telefone", "contact_phone", "tel")}
          {F("Website", "website", "url")}
        </div>
      </section>

      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold">Certificação AT</h2>
        <div className="flex items-center gap-3">
          <Switch checked={!!row.at_certified} onCheckedChange={(v) => set("at_certified", v)} />
          <span className="text-sm">Sistema certificado pela Autoridade Tributária</span>
        </div>
        {row.at_certified && F("Número do certificado AT", "at_certificate_number")}
      </section>

      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold">Redes Sociais</h2>
        <p className="text-xs text-muted-foreground">URLs completos (https://…). Deixe em branco para omitir.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Facebook</Label>
            <Input type="url" placeholder="https://facebook.com/…"
              value={row.social_links?.facebook ?? ""}
              onChange={(e) => set("social_links", { ...(row.social_links || {}), facebook: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram</Label>
            <Input type="url" placeholder="https://instagram.com/…"
              value={row.social_links?.instagram ?? ""}
              onChange={(e) => set("social_links", { ...(row.social_links || {}), instagram: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label>LinkedIn</Label>
            <Input type="url" placeholder="https://linkedin.com/company/…"
              value={row.social_links?.linkedin ?? ""}
              onChange={(e) => set("social_links", { ...(row.social_links || {}), linkedin: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label>Outro (URL)</Label>
            <Input type="url" placeholder="https://…"
              value={row.social_links?.other ?? ""}
              onChange={(e) => set("social_links", { ...(row.social_links || {}), other: e.target.value || undefined })} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold">Rodapé & Textos legais</h2>
        <div className="grid gap-4">
          <div>
            <Label>Texto do rodapé (opcional)</Label>
            <Textarea rows={2} value={row.footer_text ?? ""} onChange={(e) => set("footer_text", e.target.value || null)} />
          </div>
          <div>
            <Label>Copyright (opcional)</Label>
            <Input value={row.copyright_text ?? ""} onChange={(e) => set("copyright_text", e.target.value || null)} placeholder="Todos os direitos reservados." />
          </div>
          <div>
            <Label>Política de Privacidade (Markdown)</Label>
            <Textarea rows={4} value={row.privacy_policy ?? ""} onChange={(e) => set("privacy_policy", e.target.value || null)} />
          </div>
          <div>
            <Label>Termos de Utilização (Markdown)</Label>
            <Textarea rows={4} value={row.terms_of_service ?? ""} onChange={(e) => set("terms_of_service", e.target.value || null)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={row.show_in_footer !== false} onCheckedChange={(v) => set("show_in_footer", v)} />
            <span className="text-sm">Mostrar informações legais no rodapé</span>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
