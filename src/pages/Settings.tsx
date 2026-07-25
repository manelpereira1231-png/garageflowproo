import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Upload, Settings, Building2, Globe, FileText, Palette, Copy, ExternalLink, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsChildShop } from "@/hooks/useIsChildShop";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { getTaxIdLabel, getCountryFiscalConfig } from "@/lib/countryFields";
import { ActivateMarketplace } from "@/components/settings/ActivateMarketplace";
import { DEFAULT_OPENING_HOURS, type OpeningHours } from "@/lib/schedulingEngine";
import {
  getDefaultTimezone,
  getCountryConfig,
  listActiveCountries,
  setCountryCode as setActiveCountryCode,
  getTaxLabel,
  getCountryTimezones,
  getDefaultVatRate,
} from "@/lib/regionConfig";

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" }, { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" }, { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" }, { key: "sun", label: "Dom" },
];

export default function SettingsPage() {
  const { t, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { plan, shopId: subShopId, isEntryPlan } = useSubscription();
  const { isChildShop } = useIsChildShop();
  const activeShopId = useActiveShopId();
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [shopSlug, setShopSlug] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [countryCode, setCountryCode] = useState<string>("PT");
  // All fiscal/regional defaults are derived from the shop's country_code
  // via getCountryConfig — never from module-level hardcoded PT values.
  const countryCfg = getCountryConfig(countryCode);
  const fiscalCfg = getCountryFiscalConfig(countryCode);
  const taxLabel = getTaxLabel(countryCode);
  const timezones = getCountryTimezones(countryCode);
  const addressPlaceholder = fiscalCfg.fields.find(f => f.key === "address")?.placeholder || "";
  const billingProviderLabel: Record<string, string> = {
    invoicexpress: "InvoiceXpress", moloni: "Moloni", enotas: "eNotas",
    nuvem_fiscal: "Nuvem Fiscal", quickbooks: "QuickBooks", xero: "Xero",
    holded: "Holded", pennylane: "Pennylane", sevdesk: "sevDesk",
    zoho_books: "Zoho Books", cleartax: "ClearTax", generic: "Faturação",
  };
  const providerName = billingProviderLabel[fiscalCfg.billingProvider] || "Faturação";

  const [form, setForm] = useState({
    name: "", email: "", phone: "", country: "",
    currency: "", vat_rate: "", labor_rate: "", language: "",
    nif: "", address: "", timezone: "",
  });
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);

  useEffect(() => {
    const load = async () => {
      let shopData: any = null;
      if (activeShopId) {
        const { data } = await supabase.from("shops").select("*").eq("id", activeShopId).maybeSingle();
        shopData = data;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("shops")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(10);
        shopData = (data || []).find((s: any) => (s.name || "").trim().length > 0) ?? data?.[0];
      }

      if (shopData) {
        const cc = (shopData.country_code || "PT").toUpperCase();
        const cfg = getCountryConfig(cc);
        setShopId(shopData.id);
        setShopSlug(shopData.slug || "");
        setLogoFile(null);
        setCountryCode(cc);
        setForm({
          name: shopData.name || "", email: shopData.email || "", phone: shopData.phone || "",
          country: shopData.country || cfg.name,
          currency: shopData.currency || cfg.currency,
          vat_rate: String(shopData.vat_rate ?? getDefaultVatRate(cc)),
          labor_rate: String(shopData.labor_rate ?? 35),
          language: shopData.language || cfg.defaultLanguage,
          nif: shopData.nif || "", address: shopData.address || "",
          timezone: shopData.timezone || getDefaultTimezone(cc),
        });
        setLogoPreview(shopData.logo_url || null);
        if (shopData.opening_hours) setOpeningHours(shopData.opening_hours as OpeningHours);
      }
    };
    load();
  }, [activeShopId]);

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

    // NOTE: `country`, `country_code` and `currency` are intentionally
    // omitted here — the shop's country is fixed at creation and can only
    // be changed by a platform administrator (fiscal/legal reasons).
    const payload: any = {
      name: form.name, email: form.email, phone: form.phone,
      vat_rate: parseFloat(form.vat_rate),
      labor_rate: parseFloat(form.labor_rate), language: form.language,
      nif: form.nif, address: form.address, timezone: form.timezone,
      opening_hours: openingHours,
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t('common.sessionExpired') || "Sessão expirada"); setLoading(false); return; }
      const { data, error } = await supabase.from("shops").insert({ ...payload, user_id: user.id }).select().single();
      if (error) toast.error(error.message);
      else {
        setShopId(data.id);
        setLanguage(form.language as Language);
        toast.success(t('settings.configured'));
      }
    }
    setLoading(false);
  };

  const bookingUrl = shopSlug ? `https://garageflow.pt/book/${shopSlug}` : "";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          {t('settings.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/settings/email-templates")}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Emails automáticos</p>
              <p className="text-xs text-muted-foreground">Boas-vindas, orçamentos, serviços e faturas</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {!isChildShop && (
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/settings/billing-integration")}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{countryCode === "BR" ? "Faturação certificada (NF-e)" : "Faturação certificada (AT)"}</p>
                <p className="text-xs text-muted-foreground">
                  {countryCode === "BR"
                    ? "Liga o eNotas para emitir Nota Fiscal Eletrónica na SEFAZ"
                    : "Liga o InvoiceXpress para emitir faturas com ATCUD e QR Code"}
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Logo & Branding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="w-4 h-4" /> {t('settings.logoBranding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                <p className="text-sm font-medium">{t('settings.shopLogo')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.logoDescription')}</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
            </div>
            {!isChildShop && (
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{plan}</Badge>
                <span className="text-xs text-muted-foreground">
                  {isEntryPlan ? t('settings.watermarkInfo') : t('settings.noWatermark')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shop Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" /> {t('settings.shopInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>{t('settings.shopName')} *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.email')}</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.phone')}</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t('settings.address')}</Label>
                <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Rua das Oficinas, 123" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> País da Oficina
                </Label>
                <Select
                  value={countryCode}
                  onValueChange={(next) => {
                    if (next === countryCode) return;
                    const ok = window.confirm(
                      "A alteração do país altera moeda, impostos, emissor fiscal e configurações regionais. Confirmar?"
                    );
                    if (!ok) return;
                    setCountryCode(next);
                    setActiveCountryCode(next);
                    if (shopId) {
                      supabase
                        .from("shops")
                        .update({ country_code: next })
                        .eq("id", shopId)
                        .then(({ error }) => {
                          if (error) {
                            toast.error(
                              "Contexto atualizado, mas o país fiscal da oficina só pode ser alterado pelo suporte."
                            );
                          } else {
                            toast.success("País atualizado. A recarregar…");
                            setTimeout(() => window.location.reload(), 600);
                          }
                        });
                    } else {
                      toast.success("Contexto atualizado.");
                      setTimeout(() => window.location.reload(), 600);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {listActiveCountries().map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Define moeda, locale, timezone, impostos e emissor fiscal (PT → InvoiceXpress · BR → eNotas).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fiscal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> {t('settings.fiscal')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{getTaxIdLabel(countryCode)}</Label>
                <Input value={form.nif} onChange={e => setForm({...form, nif: e.target.value})} placeholder={getCountryFiscalConfig(countryCode).fields.find(f => f.key === "taxId")?.placeholder || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.country')}</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/40 text-sm">
                  <span>{form.country}</span>
                  <Badge variant="outline" className="text-[10px]">{countryCode}</Badge>
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground ml-auto" aria-label="País bloqueado" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O país fica bloqueado após a criação da oficina por razões fiscais e legais. Para o alterar, contacte o suporte.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.vatRate')} (%)</Label>
                <Input type="number" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.laborRate')} ({getCountryConfig(countryCode).currencySymbol}/h)</Label>
                <Input type="number" step="0.01" value={form.labor_rate} onChange={e => setForm({...form, labor_rate: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.currency')}</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/40 text-sm">
                  <span>{form.currency}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground ml-auto" aria-label="Moeda bloqueada" />
                </div>
                <p className="text-[11px] text-muted-foreground">Definida pelo país da oficina.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4" /> {t('settings.regional')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('settings.language')}</Label>
                <Select value={form.language} onValueChange={v => setForm({...form, language: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">🇵🇹 Português (PT)</SelectItem>
                    <SelectItem value="pt-BR">🇧🇷 Português (BR)</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="hi">🇮🇳 हिन्दी (Hindi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {t('settings.timezone')}
                </Label>
                <Select value={form.timezone} onValueChange={v => setForm({...form, timezone: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public booking link */}
        {bookingUrl && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{t('settings.publicBooking')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input value={bookingUrl} readOnly className="bg-background text-sm" />
                <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success(t('agenda.linkCopied')); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{t('settings.bookingDescription')}</p>
            </CardContent>
          </Card>
        )}

        {/* Marketplace — Lote A: aderir com a mesma conta */}
        <ActivateMarketplace shopId={shopId} />

        {/* Horário de funcionamento — usado pela Agenda inteligente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Horário de funcionamento
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">A Agenda usa este horário para sugerir marcações. Deixa vazio para dia fechado.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const d = openingHours[key] || { open: null, close: null, break: null };
              return (
                <div key={key} className="grid grid-cols-[50px_1fr_1fr] gap-2 items-center">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <Input
                    type="time"
                    value={d.open || ""}
                    onChange={e => setOpeningHours({
                      ...openingHours,
                      [key]: { ...d, open: e.target.value || null },
                    })}
                    className="text-sm"
                  />
                  <Input
                    type="time"
                    value={d.close || ""}
                    onChange={e => setOpeningHours({
                      ...openingHours,
                      [key]: { ...d, close: e.target.value || null },
                    })}
                    className="text-sm"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('pushNotifications') || 'Notificações'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PushNotificationToggle />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading} size="lg">
          {loading ? t('settings.saving') : t('settings.save')}
        </Button>
      </form>
    </div>
  );
}
