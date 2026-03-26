import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Wrench, ChevronRight, ChevronLeft, Check, Upload, FileText, Bell, Clock } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { VAT_RATES } from "@/types/garage";
import type { Language } from "@/i18n/translations";

const countries = Object.keys(VAT_RATES);
const CURRENCIES = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "BRL", label: "BRL (R$)" },
];
const TIMEZONES = [
  "Europe/Lisbon", "Europe/Madrid", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "America/Sao_Paulo", "America/New_York",
  "Africa/Luanda", "Africa/Maputo",
];
const STEPS = 5;

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();
  const { t, setLanguage, language } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    country: "Portugal", currency: "EUR",
    vat_rate: "23", labor_rate: "35", language: language as string,
    nif: "", address: "", timezone: "Europe/Lisbon",
  });

  // Pre-fill form with existing shop data (from signup metadata)
  useEffect(() => {
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: shop } = await supabase.from("shops").select("*").eq("user_id", user.id).maybeSingle();
      if (shop) {
        setForm(prev => ({
          ...prev,
          name: shop.name || prev.name,
          email: shop.email || user.email || prev.email,
          phone: shop.phone || prev.phone,
          country: shop.country || prev.country,
          currency: shop.currency || prev.currency,
          vat_rate: String(shop.vat_rate ?? prev.vat_rate),
          labor_rate: String(shop.labor_rate ?? prev.labor_rate),
          language: shop.language || prev.language,
          nif: shop.nif || prev.nif,
          address: shop.address || prev.address,
          timezone: shop.timezone || prev.timezone,
        }));
        if (shop.logo_url) setLogoPreview(shop.logo_url);
      }
    };
    prefill();
  }, []);
  const [alerts, setAlerts] = useState({
    pending_quotes: true,
    expired_quotes: true,
    completed_services: true,
    channel_email: true,
    channel_sms: false,
    channel_whatsapp: false,
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('error.maxFileSize'));
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (shopId: string): Promise<string | null> => {
    if (!logoFile) return null;
    const ext = logoFile.name.split('.').pop();
    const path = `${shopId}/logo.${ext}`;
    const { error } = await supabase.storage.from("shop-logos").upload(path, logoFile, { upsert: true });
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from("shop-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFinish = async () => {
    if (!form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setLoading(false); return; }

    // Get shop id - retry up to 5 times to handle trigger race condition
    let shop: { id: string } | null = null;
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase.from("shops").select("id").eq("user_id", user.id).maybeSingle();
      if (data) { shop = data; break; }
      console.log(`Shop lookup attempt ${i + 1}: data=${JSON.stringify(data)}, error=${JSON.stringify(error)}`);
      await new Promise(r => setTimeout(r, 1500));
    }

    // If shop still not found, create it as fallback
    if (!shop) {
      console.log("Shop not found after retries, creating fallback shop");
      const { data: newShop, error: createError } = await supabase
        .from("shops")
        .insert({ user_id: user.id, name: form.name, email: form.email || user.email || '' })
        .select("id")
        .single();
      if (createError || !newShop) {
        console.error("Failed to create fallback shop:", createError);
        toast.error(t('error.shopNotFound'));
        setLoading(false);
        return;
      }
      shop = newShop;
    }

    // Upload logo if provided
    const logoUrl = await uploadLogo(shop.id);

    const updatePayload: any = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      country: form.country,
      currency: form.currency,
      vat_rate: parseFloat(form.vat_rate),
      labor_rate: parseFloat(form.labor_rate),
      language: form.language,
      nif: form.nif,
      address: form.address,
      timezone: form.timezone,
    };
    if (logoUrl) updatePayload.logo_url = logoUrl;

    const { error } = await supabase.from("shops").update(updatePayload).eq("user_id", user.id);

    if (error) { toast.error(error.message); }
    else {
      // Create default alerts
      const alertTypes = [];
      if (alerts.pending_quotes) alertTypes.push({ title: "Orçamentos Pendentes", type: "quote_pending", message: "Existem orçamentos aguardando resposta do cliente." });
      if (alerts.expired_quotes) alertTypes.push({ title: "Orçamentos Expirados", type: "quote_expired", message: "Alguns orçamentos atingiram a data de validade." });
      if (alerts.completed_services) alertTypes.push({ title: "Serviços Concluídos", type: "service_completed", message: "Serviços concluídos aguardando entrega ao cliente." });

      if (alertTypes.length > 0) {
        await supabase.from("alerts").insert(
          alertTypes.map(a => ({ ...a, shop_id: shop.id, status: "pending" }))
        );
      }

      // Set active shop in localStorage so Dashboard loads data immediately
      localStorage.setItem("garageflow_active_shop", shop.id);

      setLanguage(form.language as Language);
      toast.success(t('settings.configured'));
      onComplete();
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const progress = ((step + 1) / STEPS) * 100;

  const stepTitles = [
    t('onboarding.step1') || "Dados da Oficina",
    t('onboarding.step2') || "Configurações Fiscais",
    t('onboarding.step3') || "Branding & Logo",
    t('onboarding.step4') || "Alertas & Notificações",
    t('onboarding.step5') || "Confirmação",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('onboarding.welcome')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('onboarding.subtitle')}</p>
        </div>

        {/* Progress */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{stepTitles[step]}</span>
            <span>{step + 1}/{STEPS}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mt-4">
          {/* Step 0: Shop Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">1</span>
                {stepTitles[0]}
              </h2>
              <div className="space-y-1.5">
                <Label>{t('settings.shopName')} *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Auto Centro Lisboa" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('settings.email')}</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="oficina@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.phone')}</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+351 912 345 678" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('settings.country')}</Label>
                  <Select value={form.country} onValueChange={v => setForm({...form, country: v, vat_rate: String(VAT_RATES[v] || 23)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.language')}</Label>
                  <Select value={form.language} onValueChange={v => setForm({...form, language: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">🇵🇹 Português (PT)</SelectItem>
                      <SelectItem value="pt-BR">🇧🇷 Português (BR)</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Fiscal */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">2</span>
                {stepTitles[1]}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>NIF / VAT *</Label>
                  <Input value={form.nif} onChange={e => setForm({...form, nif: e.target.value})} placeholder="123456789" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.vatRate')}</Label>
                  <Input type="number" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.address')}</Label>
                <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Rua das Oficinas, 123, Lisboa" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('settings.laborRate')}</Label>
                  <Input type="number" step="0.01" value={form.labor_rate} onChange={e => setForm({...form, labor_rate: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.currency')}</Label>
                  <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('settings.timezone')}</Label>
                <Select value={form.timezone} onValueChange={v => setForm({...form, timezone: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Branding & Logo */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">3</span>
                {stepTitles[2]}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('onboarding.brandingDesc')}
              </p>
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="w-32 h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/30"
                  onClick={() => fileRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <span className="text-xs text-muted-foreground">Upload Logo</span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG · max 2MB</p>
              </div>
              {/* PDF Preview hint */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground flex items-start gap-3">
                <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground mb-1">{t('onboarding.pdfPreviewTitle')}</p>
                  <p>{t('onboarding.pdfPreviewDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Alerts */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">4</span>
                <Bell className="w-4 h-4" />
                {stepTitles[3]}
              </h2>
              <p className="text-sm text-muted-foreground">{t('onboarding.alertsDesc')}</p>
              <div className="space-y-3">
                {[
                  { key: 'pending_quotes' as const, label: t('onboarding.alert.pendingQuotes'), desc: t('onboarding.alert.pendingQuotesDesc') },
                  { key: 'expired_quotes' as const, label: t('onboarding.alert.expiredQuotes'), desc: t('onboarding.alert.expiredQuotesDesc') },
                  { key: 'completed_services' as const, label: t('onboarding.alert.completedServices'), desc: t('onboarding.alert.completedServicesDesc') },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={alerts[item.key]} onCheckedChange={v => setAlerts({...alerts, [item.key]: v})} />
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <Label className="text-sm font-medium mb-2 block">{t('onboarding.notificationChannels')}</Label>
                <div className="flex gap-3">
                  {[
                    { key: 'channel_email' as const, label: 'Email' },
                    { key: 'channel_sms' as const, label: 'SMS' },
                    { key: 'channel_whatsapp' as const, label: 'WhatsApp' },
                  ].map(ch => (
                    <label key={ch.key} className="flex items-center gap-2 text-sm">
                      <Switch checked={alerts[ch.key]} onCheckedChange={v => setAlerts({...alerts, [ch.key]: v})} />
                      {ch.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">5</span>
                {stepTitles[4]}
              </h2>
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                <p>✅ <strong>{t('settings.shopName')}:</strong> {form.name || '—'}</p>
                <p>✅ <strong>{t('settings.country')}:</strong> {form.country} ({form.vat_rate}% IVA)</p>
                <p>✅ <strong>NIF/VAT:</strong> {form.nif || '—'}</p>
                <p>✅ <strong>{t('settings.address')}:</strong> {form.address || '—'}</p>
                <p>✅ <strong>{t('settings.laborRate')}:</strong> {form.currency} {form.labor_rate}/h</p>
                <p>✅ <strong>{t('settings.timezone')}:</strong> {form.timezone}</p>
                <p>✅ <strong>Logo:</strong> {logoFile ? logoFile.name : t('onboarding.noLogo')}</p>
                <p>✅ <strong>{t('onboarding.alertsLabel')}:</strong> {[alerts.pending_quotes && t('onboarding.alert.pendingQuotes'), alerts.expired_quotes && t('onboarding.alert.expiredQuotes'), alerts.completed_services && t('onboarding.alert.completedServices')].filter(Boolean).join(', ') || t('onboarding.noAlerts')}</p>
                <p>✅ <strong>{t('onboarding.plan')}:</strong> FREE ({t('billing.trial30')})</p>
              </div>
              {logoPreview && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-lg object-contain" />
                  <span className="text-sm text-muted-foreground">{t('settings.shopLogo')}</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" />{t('onboarding.back')}
              </Button>
            )}
            {step < STEPS - 1 ? (
              <Button type="button" onClick={() => {
                if (step === 0 && !form.name.trim()) { toast.error(t('common.required')); return; }
                setStep(step + 1);
              }} className="flex-1">
                {t('onboarding.next')}<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={loading} className="flex-1">
                {loading ? t('settings.saving') : t('onboarding.finish')}
                <Check className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
