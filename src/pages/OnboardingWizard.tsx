import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { VAT_RATES } from "@/types/garage";
import type { Language } from "@/i18n/translations";

const countries = Object.keys(VAT_RATES);
const STEPS = 3;

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { t, setLanguage, language } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    country: "Portugal", currency: "EUR",
    vat_rate: "23", labor_rate: "35", language: language as string,
  });

  const handleFinish = async () => {
    if (!form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setLoading(false); return; }

    const { error } = await supabase.from("shops").update({
      name: form.name,
      email: form.email,
      phone: form.phone,
      country: form.country,
      currency: form.currency,
      vat_rate: parseFloat(form.vat_rate),
      labor_rate: parseFloat(form.labor_rate),
      language: form.language,
    }).eq("user_id", user.id);

    if (error) { toast.error(error.message); }
    else {
      setLanguage(form.language as Language);
      toast.success(t('settings.configured'));
      onComplete();
    }
    setLoading(false);
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: STEPS }).map((_, i) => (
        <div key={i} className={`h-2 rounded-full transition-all duration-300 ${
          i === step ? 'w-8 bg-primary' : i < step ? 'w-2 bg-primary/60' : 'w-2 bg-border'
        }`} />
      ))}
    </div>
  );

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

        {stepIndicator}

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {/* Step 0: Shop Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">1</span>
                {t('onboarding.step1')}
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
            </div>
          )}

          {/* Step 1: Fiscal */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">2</span>
                {t('onboarding.step2')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('settings.country')}</Label>
                  <Select value={form.country} onValueChange={v => setForm({...form, country: v, vat_rate: String(VAT_RATES[v] || 23)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.vatRate')}</Label>
                  <Input type="number" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.laborRate')}</Label>
                  <Input type="number" step="0.01" value={form.labor_rate} onChange={e => setForm({...form, labor_rate: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.currency')}</Label>
                  <Input value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Language */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">3</span>
                {t('onboarding.step3')}
              </h2>
              <div className="space-y-1.5">
                <Label>{t('settings.language')}</Label>
                <Select value={form.language} onValueChange={v => setForm({...form, language: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>✅ {t('settings.shopName')}: <strong className="text-foreground">{form.name || '—'}</strong></p>
                <p>✅ {t('settings.country')}: <strong className="text-foreground">{form.country}</strong> ({form.vat_rate}% IVA)</p>
                <p>✅ {t('settings.laborRate')}: <strong className="text-foreground">{form.currency} {form.labor_rate}/h</strong></p>
              </div>
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
