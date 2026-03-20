import { useState, useEffect } from "react";
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
            // Find the referrer by code
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

        // Sign out after signup so user must log in explicitly
        await supabase.auth.signOut();
        toast.success(t('auth.accountCreated'));
        setMode('login');
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
        <Select value={language} onValueChange={(v: 'pt' | 'en' | 'es') => setLanguage(v)}>
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pt">Português</SelectItem>
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
          <h1 className="text-2xl font-bold tracking-tight">
            Garage<span className="text-primary">Flow</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('app.tagline')}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            {mode === 'forgot' ? t('auth.resetPassword') : mode === 'login' ? t('auth.login') : t('auth.signup')}
          </h2>

          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('auth.backToLogin')}
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerName">{t('auth.ownerName') || 'Nome completo'}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="ownerName" placeholder="Manuel Pereira" value={name} onChange={e => setName(e.target.value)} className="pl-9" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shopName">{t('auth.shopName')}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="shopName" placeholder="Auto Centro Lisboa" value={shopName} onChange={e => setShopName(e.target.value)} className="pl-9" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('settings.country') || 'País'}</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nif">NIF / VAT</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="nif" placeholder="123456789" value={nif} onChange={e => setNif(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="oficina@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" required />
              </div>
            </div>
            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9" required minLength={6} />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t('auth.processing')
                : mode === 'forgot'
                  ? t('auth.sendResetLink')
                  : mode === 'login'
                    ? t('auth.login')
                    : t('auth.signup')}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {mode === 'login' && (
              <button onClick={() => setMode('forgot')} className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('auth.forgotPassword')}
              </button>
            )}
            {mode !== 'forgot' && (
              <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
