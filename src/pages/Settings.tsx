import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { VAT_RATES } from "@/types/garage";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const countries = Object.keys(VAT_RATES);

export default function SettingsPage() {
  const { t, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", country: "Portugal",
    currency: "EUR", vat_rate: "23", labor_rate: "35", language: "pt",
    nif: "", address: "",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("shops").select("*").eq("user_id", user.id).single();
      if (data) {
        setShopId(data.id);
        setForm({
          name: data.name || "", email: data.email || "", phone: data.phone || "",
          country: data.country || "Portugal", currency: data.currency || "EUR",
          vat_rate: String(data.vat_rate ?? 23), labor_rate: String(data.labor_rate ?? 35),
          language: data.language || "pt",
          nif: (data as any).nif || "", address: (data as any).address || "",
        });
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
    };
    load();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t('error.maxFileSize')); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setLoading(false); return; }

    let logoUrl: string | undefined;
    if (logoFile && shopId) {
      const ext = logoFile.name.split('.').pop();
      const path = `${shopId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("shop-logos").upload(path, logoFile, { upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("shop-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }
    }

    const payload: any = {
      user_id: user.id, name: form.name, email: form.email, phone: form.phone,
      country: form.country, currency: form.currency, vat_rate: parseFloat(form.vat_rate),
      labor_rate: parseFloat(form.labor_rate), language: form.language,
      nif: form.nif, address: form.address,
    };
    if (logoUrl) payload.logo_url = logoUrl;

    if (shopId) {
      const { error } = await supabase.from("shops").update(payload).eq("id", shopId);
      if (error) toast.error(error.message);
      else {
        setLanguage(form.language as Language);
        toast.success(t('settings.saved'));
      }
    } else {
      const { data, error } = await supabase.from("shops").insert(payload).select().single();
      if (error) toast.error(error.message);
      else {
        setShopId(data.id);
        setLanguage(form.language as Language);
        toast.success(t('settings.configured'));
      }
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('settings.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Logo & Branding</h3>
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/30"
              onClick={() => fileRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Logo da oficina</p>
              <p className="text-xs text-muted-foreground">Aparece nos PDFs, dashboard e emails</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">{t('settings.shopInfo')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>{t('settings.shopName')} *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="space-y-1.5"><Label>{t('settings.email')}</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>{t('settings.phone')}</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">{t('settings.fiscal')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>NIF / VAT</Label>
              <Input value={form.nif} onChange={e => setForm({...form, nif: e.target.value})} placeholder="123456789" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Morada</Label>
              <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Rua das Oficinas, 123" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.country')}</Label>
              <Select value={form.country} onValueChange={v => setForm({...form, country: v, vat_rate: String(VAT_RATES[v] || 23)})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('settings.vatRate')}</Label><Input type="number" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>{t('settings.laborRate')}</Label><Input type="number" step="0.01" value={form.labor_rate} onChange={e => setForm({...form, labor_rate: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>{t('settings.currency')}</Label><Input value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} /></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">{t('settings.language')}</h3>
          <Select value={form.language} onValueChange={v => setForm({...form, language: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pt">Português</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('settings.saving') : t('settings.save')}
        </Button>
      </form>
    </div>
  );
}
