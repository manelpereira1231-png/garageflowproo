import { useState, useEffect } from "react";
import { trackSignupConversion, trackSignupPageView, captureAdsParams } from "@/lib/gadsTracking";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Mail, Lock, User, ArrowLeft, Building2, Globe, Car, ShieldCheck, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const PARTNER_STORAGE_KEY = "garageflow_affiliate_partner";

type AccountType = "particular" | "garage";

export default function Auth() {
  const { t, language, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const fromMarket = searchParams.get('from') === 'market';
  const redirect = searchParams.get('redirect') || '';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [accountType, setAccountType] = useState<AccountType>(fromMarket ? "particular" : "garage");

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
        const isGarage = accountType === "garage";

        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              owner_name: name,
              name: isGarage ? (shopName || name) : name,
              referral_code: refCode || undefined,
              account_type: accountType,
              ...(isGarage ? {} : { carity_user: true, skip_shop_creation: true }),
            },
            emailRedirectTo: window.location.origin,
          }
        });
        if (error) throw error;

        if (signUpData?.user) {
          if (isGarage) {
            await supabase.from("user_roles" as any).insert({ user_id: signUpData.user.id, role: "garage_owner" });
          } else {
            await supabase.from("user_roles" as any).insert([
              { user_id: signUpData.user.id, role: "buyer" },
              { user_id: signUpData.user.id, role: "seller" },
            ]);
            await supabase.from("carity_seller_profiles").insert({
              user_id: signUpData.user.id,
              name,
              phone: phone || "",
              location: location || "",
            });
          }
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
        toast.success(t('auth.accountCreated'));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Theme: Market dark theme ONLY on signup with particular selected, or when coming from /market
  const isMarketTheme = mode === 'signup' && (fromMarket || accountType === "particular");

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative transition-colors duration-300 ${isMarketTheme ? 'bg-slate-950' : 'bg-background'}`}>
      {/* Language selector */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Globe className={`w-4 h-4 ${isMarketTheme ? 'text-slate-400' : 'text-muted-foreground'}`} />
        <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
          <SelectTrigger className={`w-[100px] h-8 text-xs ${isMarketTheme ? 'bg-slate-800 border-slate-700 text-white' : ''}`}>
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

      {/* Back to home */}
      <Link to="/" className={`absolute top-4 left-4 text-xs flex items-center gap-1 hover:underline ${isMarketTheme ? 'text-slate-400 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}>
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar
      </Link>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {isMarketTheme ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
                <ShieldCheck className="w-7 h-7 text-slate-900" />
              </div>
              <h1 className="text-2xl font-bold text-white">GarageFlow <span className="text-amber-400">Market</span></h1>
              <p className="text-slate-400 text-sm mt-1">Marketplace de carros certificados</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Wrench className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">{t('app.name')}</h1>
              <p className="text-muted-foreground text-sm mt-1">{t('app.tagline')}</p>
            </>
          )}
          {getPartnerId() && mode === 'signup' && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
              <User className="w-3 h-3" />
              {t('auth.partnerInviteActive')}
            </div>
          )}
        </div>

        {/* Form card */}
        <div className={`border rounded-2xl p-6 shadow-sm ${isMarketTheme ? 'bg-slate-900 border-slate-800' : 'bg-card'}`}>
          <h2 className={`text-lg font-semibold mb-1 ${isMarketTheme ? 'text-white' : ''}`}>
            {mode === 'forgot' ? t('auth.resetPassword') : mode === 'login' ? t('auth.login') : t('auth.signup')}
          </h2>
          <p className={`text-sm mb-6 ${isMarketTheme ? 'text-slate-400' : 'text-muted-foreground'}`}>
            {mode === 'forgot' ? t('auth.sendResetLink') : mode === 'login' ? t('auth.welcomeBack') : t('auth.signupSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account type selection - only on signup */}
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setAccountType("particular")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    accountType === "particular"
                      ? "border-amber-400 bg-amber-400/10 text-amber-400"
                      : isMarketTheme
                        ? "border-slate-700 text-slate-400 hover:border-slate-600"
                        : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Car className="w-6 h-6" />
                  <span className="text-sm font-medium">Particular</span>
                  <span className={`text-xs ${accountType === "particular" ? "text-amber-400/70" : isMarketTheme ? "text-slate-500" : "text-muted-foreground"}`}>
                    Comprar / Vender
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("garage")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    accountType === "garage"
                      ? "border-primary bg-primary/10 text-primary"
                      : isMarketTheme
                        ? "border-slate-700 text-slate-400 hover:border-slate-600"
                        : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Wrench className="w-6 h-6" />
                  <span className="text-sm font-medium">Oficina</span>
                  <span className={`text-xs ${accountType === "garage" ? "" : isMarketTheme ? "text-slate-500" : "text-muted-foreground"}`}>
                    Gerir oficina
                  </span>
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label className={`flex items-center gap-1.5 text-sm ${isMarketTheme ? 'text-slate-300' : ''}`}>
                    <User className="w-3.5 h-3.5" />{t('auth.ownerName')}
                  </Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    maxLength={100}
                    placeholder={t('auth.ownerName')}
                    className={isMarketTheme ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : ''}
                  />
                </div>

                {accountType === "garage" && (
                  <div className="space-y-1.5">
                    <Label className={`flex items-center gap-1.5 text-sm ${isMarketTheme ? 'text-slate-300' : ''}`}>
                      <Building2 className="w-3.5 h-3.5" />{t('auth.shopName')}
                    </Label>
                    <Input
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      maxLength={100}
                      placeholder={`${t('auth.shopName')} (${t('common.optional')})`}
                      className={isMarketTheme ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : ''}
                    />
                  </div>
                )}

                {accountType === "particular" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className={`flex items-center gap-1.5 text-sm text-slate-300`}>
                        <Phone className="w-3.5 h-3.5" /> Telefone
                      </Label>
                      <Input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+351 9XX XXX XXX"
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={`flex items-center gap-1.5 text-sm text-slate-300`}>
                        <MapPin className="w-3.5 h-3.5" /> Localização
                      </Label>
                      <Input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Lisboa, Porto..."
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label className={`flex items-center gap-1.5 text-sm ${isMarketTheme ? 'text-slate-300' : ''}`}>
                <Mail className="w-3.5 h-3.5" />{t('auth.email')}
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="email@exemplo.com"
                className={isMarketTheme ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : ''}
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <Label className={`flex items-center gap-1.5 text-sm ${isMarketTheme ? 'text-slate-300' : ''}`}>
                  <Lock className="w-3.5 h-3.5" />{t('auth.password')}
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={100}
                  placeholder="••••••"
                  className={isMarketTheme ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : ''}
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <Button
              type="submit"
              className={`w-full h-11 font-semibold ${isMarketTheme ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' : ''}`}
              disabled={loading}
            >
              {loading ? t('auth.processing') : mode === 'forgot' ? t('auth.sendResetLink') : mode === 'login' ? t('auth.login') : t('auth.signup')}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'forgot' ? (
              <button onClick={() => setMode('login')} className={`hover:underline flex items-center gap-1 mx-auto ${isMarketTheme ? 'text-amber-400' : 'text-primary'}`}>
                <ArrowLeft className="w-3.5 h-3.5" /> {t('auth.backToLogin')}
              </button>
            ) : mode === 'login' ? (
              <button onClick={() => setMode('signup')} className="text-primary hover:underline">
                {t('auth.noAccount')}
              </button>
            ) : (
              <button onClick={() => setMode('login')} className={`hover:underline ${isMarketTheme ? 'text-amber-400' : 'text-primary'}`}>
                {t('auth.hasAccount')}
              </button>
            )}
          </div>
        </div>

        {/* Footer context */}
        {isMarketTheme && (
          <p className="text-center text-xs text-slate-500 mt-6">
            GarageFlow Market é um serviço de <Link to="/" className="text-amber-400 hover:underline">GarageFlow</Link>
          </p>
        )}
        {!isMarketTheme && mode === 'login' && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            Quer comprar ou vender carros? <Link to="/market" className="text-primary hover:underline">Visite o GarageFlow Market →</Link>
          </p>
        )}
      </div>
    </div>
  );
}
