import { useState, useEffect } from "react";
import { trackSignupConversion, trackSignupPageView, captureAdsParams } from "@/lib/gadsTracking";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { erpSupabase } from "@/integrations/supabase/realmClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Mail, Lock, User, ArrowLeft, Building2, Globe, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { setOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { getUserAccessProfile } from "@/lib/authRealm";
import { ensureSignupAllowed } from "@/lib/signupGuard";

const PARTNER_STORAGE_KEY = "garageflow_affiliate_partner";
const LOGIN_PROFILE_TIMEOUT_MS = 3000;

const getSafeGarageRedirectPath = (candidate: string | null) => {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }
  // Only the Market realm paths must bounce back to /dashboard — "/marketing"
  // is an ERP module and must be preserved as a valid redirect target.
  if (candidate === "/market" || candidate.startsWith("/market/")) {
    return "/dashboard";
  }
  return candidate;
};

function timeoutResult<T>(value: T, ms = LOGIN_PROFILE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

export default function Auth({ defaultRedirect }: { defaultRedirect?: string } = {}) {
  const { t, language, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");

  const urlPartnerId = searchParams.get('partner');
  
  useEffect(() => {
    captureAdsParams();
    if (initialMode === 'signup') trackSignupPageView();
    if (urlPartnerId) {
      localStorage.setItem(PARTNER_STORAGE_KEY, urlPartnerId);
    }
  }, [urlPartnerId]);

  const getPartnerId = (): string | null => {
    return urlPartnerId || localStorage.getItem(PARTNER_STORAGE_KEY);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error } = await erpSupabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password?realm=erp`,
        });
        if (error) throw error;
        toast.success(t('auth.resetSent'));
        setMode('login');
      } else if (mode === 'login') {
        const { data: signInData, error } = await erpSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Lote A: contas unificadas. Só bloqueia se a conta for exclusivamente
        // Market (particular sem shop nem role ERP). Contas de oficina que
        // também activaram o Market continuam a poder entrar no ERP.
        const accessProfile = signInData.user
          ? await Promise.race([
              getUserAccessProfile(signInData.user),
              timeoutResult({ isAffiliate: false, isGarageUser: true, isMarketUser: false, hasGarageRole: true, hasMarketRole: false, hasShopAccess: true }),
            ])
          : null;

        if (!signInData.user || !accessProfile?.isGarageUser) {
          throw new Error('Esta conta é apenas do GarageFlow Market. Entre em /market/auth.');
        }

        toast.success(t('auth.welcomeBack'));
        import("@/lib/trackEvent").then(({ trackEvent }) => trackEvent("login", { realm: "erp" }));
        navigate(getSafeGarageRedirectPath(searchParams.get("redirect") ?? defaultRedirect ?? null), { replace: true });

      } else {
        const refCode = searchParams.get('ref') || '';

        // Anti-flood: server-side rate limit by IP and email
        await ensureSignupAllowed(email, "erp");

        const { data: signUpData, error } = await erpSupabase.auth.signUp({
          email, password,
          options: {
            data: {
              owner_name: name,
              name: shopName || name,
              referral_code: refCode || undefined,
              account_type: "garage",
            },
            emailRedirectTo: window.location.origin,
          }
        });
        if (error) throw error;

        if (signUpData?.user) {
          await supabase.from("user_roles" as any).insert({ user_id: signUpData.user.id, role: "garage_owner" });
          // Force guided mode for every brand-new account so the SaaS starts simplified
          setOnboardingStatus("guided");
          import("@/lib/trackEvent").then(({ trackEvent }) => trackEvent("signup", { realm: "erp", account_type: "garage" }));
        }


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
            localStorage.removeItem(PARTNER_STORAGE_KEY);
          } catch (partnerErr) {
            console.warn("Partner tracking failed:", partnerErr);
          }
        }

        trackSignupConversion(email);
        if (signUpData?.session) {
          toast.success(t('auth.accountCreated'));
          navigate(getSafeGarageRedirectPath(searchParams.get("redirect") ?? defaultRedirect ?? null), { replace: true });
        } else {
          toast.success("Confirme o seu email para ativar a conta. Verifique a caixa de entrada (e spam).", { duration: 8000 });
          setMode('login');
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-background">
      {/* Language selector */}
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
            <SelectItem value="hi">हिन्दी</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Back to home */}
      <Link to="/" className="absolute top-4 left-4 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" /> {t('common.back')}
      </Link>

      <div className="w-full max-w-md">
        {/* Header — always GarageFlow ERP branding */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t('app.name')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'signup' ? 'Software de gestão para oficinas' : t('app.tagline')}
          </p>
          {getPartnerId() && mode === 'signup' && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
              <User className="w-3 h-3" />
              {t('auth.partnerInviteActive')}
            </div>
          )}
        </div>

        {/* Form card */}
        <div className="border rounded-2xl p-6 shadow-sm bg-card">
          <h2 className="text-lg font-semibold mb-1">
            {mode === 'forgot' ? t('auth.resetPassword') : mode === 'login' ? t('auth.login') : t('auth.signup')}
          </h2>
          <p className="text-sm mb-6 text-muted-foreground">
            {mode === 'forgot' ? t('auth.sendResetLink') : mode === 'login' ? t('auth.welcomeBack') : 'Crie a sua conta de oficina'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <User className="w-3.5 h-3.5" />{t('auth.ownerName')}
                  </Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    maxLength={100}
                    placeholder={t('auth.ownerName')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Building2 className="w-3.5 h-3.5" />{t('auth.shopName')}
                  </Label>
                  <Input
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    maxLength={100}
                    placeholder={`${t('auth.shopName')} (${t('common.optional')})`}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Mail className="w-3.5 h-3.5" />{t('auth.email')}
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="email@exemplo.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Lock className="w-3.5 h-3.5" />{t('auth.password')}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={100}
                    placeholder="••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
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

        {/* Footer — cross-link to Market */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Quer comprar ou vender carros? <Link to="/market/auth?mode=signup" className="text-primary hover:underline">Visite o GarageFlow Market →</Link>
        </p>

        {/* Legal links */}
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <Link to="/legal/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
          <span>·</span>
          <Link to="/legal/terms" className="hover:text-foreground transition-colors">Termos</Link>
          <span>·</span>
          <Link to="/legal/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          <span>·</span>
          <Link to="/legal/dpa" className="hover:text-foreground transition-colors">DPA</Link>
          <span>·</span>
          <Link to="/legal/my-data" className="hover:text-foreground transition-colors">Os Meus Dados</Link>
          <span>·</span>
          <Link to="/support" className="text-primary hover:opacity-80 font-medium transition-colors">Suporte</Link>
        </nav>
      </div>
    </div>
  );
}
