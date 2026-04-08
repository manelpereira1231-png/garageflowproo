import { useState, useEffect } from "react";
import { trackSignupConversion, trackSignupPageView, captureAdsParams } from "@/lib/gadsTracking";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Mail, Lock, User, ArrowLeft, Building2, MapPin, Globe } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { VAT_RATES } from "@/types/garage";

const countries = Object.keys(VAT_RATES);

const PARTNER_STORAGE_KEY = "garageflow_affiliate_partner";

export default function Auth() {
  const { t, language, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [country, setCountry] = useState("Portugal");
  const [nif, setNif] = useState("");

  // Capture and persist partner ID from URL or localStorage
  const urlPartnerId = searchParams.get('partner');
  
  useEffect(() => {
    captureAdsParams();
    if (initialMode === 'signup') trackSignupPageView();
    if (urlPartnerId) {
      localStorage.setItem(PARTNER_STORAGE_KEY, urlPartnerId);
    }
  }, [urlPartnerId]);

  // Get partner ID: prefer URL param, fallback to localStorage
  const getPartnerId = (): string | null => {
    return urlPartnerId || localStorage.getItem(PARTNER_STORAGE_KEY);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t('auth.resetSent'));
        setMode('login');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t('auth.welcomeBack'));
      } else {
        const refCode = searchParams.get('ref') || '';
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              owner_name: name,
              name: shopName || name,
              shop_country: country,
              shop_nif: nif,
              referral_code: refCode || undefined,
            },
            emailRedirectTo: window.location.origin,
          }
        });
        if (error) throw error;

        // If signup had a referral code, create the referral record
        if (refCode && signUpData?.user) {
          try {
            const { data: codeData } = await supabase
              .from("referral_codes")
              .select("user_id, code")
              .eq("code", refCode)
              .maybeSingle();

            if (codeData && codeData.user_id !== signUpData.user.id) {
              await supabase.from("referrals").insert({
                referrer_user_id: codeData.user_id,
                referred_user_id: signUpData.user.id,
                referral_code: refCode,
                status: 'pending',
              });
            }
          } catch (refErr) {
            console.warn("Referral tracking failed:", refErr);
          }
        }

        // Track affiliate partner signup via edge function (bypasses RLS)
        const partnerId = getPartnerId();
        if (partnerId && signUpData?.user) {
          try {
            await supabase.functions.invoke("track-affiliate-signup", {
              body: {
                partner_id: partnerId,
                user_id: signUpData.user.id,
                email,
                shop_name: shopName,
              },
            });
            // Clear stored partner after successful tracking
            localStorage.removeItem(PARTNER_STORAGE_KEY);
          } catch (partnerErr) {
            console.warn("Partner tracking failed:", partnerErr);
          }
        }

        // Google Ads conversion tracking with enhanced conversions
        trackSignupConversion(email);

        toast.success(t('auth.accountCreated'));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pt">Português</SelectItem>
            <SelectItem value="pt-BR">Brasileiro</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t('app.name')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('app.tagline')}</p>
          {getPartnerId() && mode === 'signup' && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
              <User className="w-3 h-3" />
              {t('auth.partnerInviteActive')}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">
            {mode === 'forgot' ? t('auth.resetPassword') : mode === 'login' ? t('auth.login') : t('auth.signup')}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'forgot' ? t('auth.sendResetLink') : mode === 'login' ? t('auth.welcomeBack') : t('auth.signupSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm"><User className="w-3.5 h-3.5" />{t('auth.ownerName')}</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required maxLength={100} placeholder={t('auth.ownerName')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm"><Building2 className="w-3.5 h-3.5" />{t('auth.shopName')}</Label>
                  <Input value={shopName} onChange={e => setShopName(e.target.value)} maxLength={100} placeholder={t('auth.shopName')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm"><MapPin className="w-3.5 h-3.5" />{t('settings.country')}</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">NIF</Label>
                    <Input value={nif} onChange={e => setNif(e.target.value)} maxLength={20} placeholder={t('common.optional')} />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm"><Mail className="w-3.5 h-3.5" />{t('auth.email')}</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={255} placeholder="email@exemplo.com" />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm"><Lock className="w-3.5 h-3.5" />{t('auth.password')}</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} maxLength={100} placeholder="••••••" />
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? t('auth.processing') : mode === 'forgot' ? t('auth.sendResetLink') : mode === 'login' ? t('auth.login') : t('auth.signup')}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'forgot' ? (
              <button onClick={() => setMode('login')} className="text-primary hover:underline flex items-center gap-1 mx-auto">
                <ArrowLeft className="w-3.5 h-3.5" /> {t('auth.backToLogin')}
              </button>
            ) : mode === 'login' ? (
              <button onClick={() => setMode('signup')} className="text-primary hover:underline">
                {t('auth.noAccount')}
              </button>
            ) : (
              <button onClick={() => setMode('login')} className="text-primary hover:underline">
                {t('auth.hasAccount')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
