import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User, Phone, MapPin, Mail, ShieldCheck, Save, Loader2,
  Building2, Hash, Award, Globe, ExternalLink, Crown, Sparkles, Settings, Car,
} from "lucide-react";
import { toast } from "sonner";
import MarketLayout from "@/components/MarketLayout";
import { useMarketT } from "@/i18n/marketTranslations";

export default function MarketProfile() {
  const t = useMarketT();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [verified, setVerified] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [stats, setStats] = useState({ listings: 0, sold: 0, inspections: 0 });

  // Dealer-specific
  const [isDealer, setIsDealer] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [nif, setNif] = useState("");
  const [dealerLicense, setDealerLicense] = useState("");
  const [dealerSlug, setDealerSlug] = useState("");
  const [dealerPlan, setDealerPlan] = useState<string>("free");
  const [dealerActiveUntil, setDealerActiveUntil] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth"); return; }

    setEmail(user.email || "");

    const { data: profile } = await supabase
      .from("carity_seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setLocation(profile.location || "");
      setVerified(profile.verified || false);
      setProfileExists(true);

      const dealer = (profile as any).account_type === "dealer";
      setIsDealer(dealer);
      if (dealer) {
        setCompanyName((profile as any).dealer_company_name || "");
        setNif((profile as any).dealer_nif || "");
        setDealerLicense((profile as any).dealer_license || "");
        setDealerSlug((profile as any).dealer_slug || "");
        setDealerPlan((profile as any).dealer_plan || "free");
        setDealerActiveUntil((profile as any).dealer_active_until || null);
      }
    } else {
      setName(user.user_metadata?.name || "");
      setPhone(user.user_metadata?.phone || "");
      setLocation(user.user_metadata?.location || "");
    }

    const { data: listings } = await supabase
      .from("carity_listings")
      .select("id, status")
      .eq("seller_id", user.id);

    const all = listings || [];
    const listingIds = all.map(l => l.id);

    let inspCount = 0;
    if (listingIds.length > 0) {
      const { count } = await supabase
        .from("carity_inspections")
        .select("id", { count: "exact", head: true })
        .in("listing_id", listingIds)
        .eq("status", "completed");
      inspCount = count || 0;
    }

    setStats({
      listings: all.length,
      sold: all.filter(l => l.status === "sold").length,
      inspections: inspCount,
    });

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload: any = isDealer
        ? {
            name: companyName || name,
            phone,
            location,
            dealer_company_name: companyName,
            dealer_license: dealerLicense || null,
          }
        : { name, phone, location };

      if (profileExists) {
        const { error } = await supabase
          .from("carity_seller_profiles")
          .update(payload)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("carity_seller_profiles")
          .insert({ user_id: user.id, ...payload });
        if (error) throw error;
        setProfileExists(true);
      }

      toast.success(t("profile.toast.saved"));
    } catch (err: any) {
      toast.error(err.message || t("profile.toast.err"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MarketLayout variant={isDealer ? "dealer" : undefined}>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </MarketLayout>
    );
  }

  // ============================================================
  // DEALER PROFILE — completely distinct B2B layout
  // ============================================================
  if (isDealer) {
    const planLabel = ({ free: "Sem plano", starter: "Starter", pro: "Pro", unlimited: "Unlimited" } as any)[dealerPlan] || dealerPlan;

    return (
      <MarketLayout variant="dealer">
        {/* B2B Hero */}
        <div className="relative overflow-hidden rounded-2xl mb-6 border border-amber-500/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6 shadow-xl">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 12px, rgba(245,158,11,0.6) 12px 13px)" }} />
          <div className="relative flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                <Building2 className="w-8 h-8 text-zinc-900" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-bold">Conta Profissional</p>
                <h1 className="text-2xl font-bold text-white truncate">{companyName || "O meu Stand"}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge className={`text-[10px] ${dealerPlan === "free" ? "bg-zinc-700 text-zinc-300" : "bg-amber-500 text-zinc-900"}`}>
                    {dealerPlan === "unlimited" && <Crown className="w-3 h-3 mr-1" />}
                    {planLabel}
                  </Badge>
                  {verified && (
                    <Badge className="text-[10px] bg-emerald-600/20 text-emerald-300 border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verificado
                    </Badge>
                  )}
                  {nif && (
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> NIF {nif}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button asChild className="flex-1 sm:flex-none bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-900 font-semibold">
                <Link to="/market/dealer-dashboard"><Settings className="w-4 h-4 mr-1" /> Painel Stand</Link>
              </Button>
              {dealerSlug && (
                <Button asChild variant="outline" className="flex-1 sm:flex-none border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10">
                  <Link to={`/market/stand/${dealerSlug}`} target="_blank">
                    <Globe className="w-4 h-4 mr-1" /> Ver página pública <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* B2B KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1"><Car className="w-3.5 h-3.5" /> Inventário</div>
              <p className="text-2xl font-bold text-white">{stats.listings}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1"><Sparkles className="w-3.5 h-3.5" /> Vendidos</div>
              <p className="text-2xl font-bold text-white">{stats.sold}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1"><ShieldCheck className="w-3.5 h-3.5" /> Inspeções</div>
              <p className="text-2xl font-bold text-white">{stats.inspections}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Empresa form */}
          <div className="md:col-span-2">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Building2 className="h-5 w-5 text-amber-400" />
                  Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-zinc-300">Email profissional</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-400">{email}</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="company" className="text-zinc-300">Nome do Stand / Razão Social</Label>
                  <Input id="company" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Auto Stand Lisboa, Lda." className="bg-zinc-950/60 border-zinc-800 text-white" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-zinc-300">NIF</Label>
                    <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md bg-zinc-950/40 border border-zinc-800">
                      <Hash className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm text-zinc-400">{nif || "—"}</span>
                      <Badge variant="outline" className="ml-auto text-[9px] border-zinc-700 text-zinc-500">Bloqueado</Badge>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="lic" className="text-zinc-300">Nº Licença IMT</Label>
                    <div className="relative">
                      <Award className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <Input id="lic" value={dealerLicense} onChange={e => setDealerLicense(e.target.value)} placeholder="Ex: 12345/CE" className="pl-9 bg-zinc-950/60 border-zinc-800 text-white" />
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone" className="text-zinc-300">Telefone comercial</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351..." className="pl-9 bg-zinc-950/60 border-zinc-800 text-white" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location" className="text-zinc-300">Morada / Cidade</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Lisboa, Porto..." className="pl-9 bg-zinc-950/60 border-zinc-800 text-white" />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-900 font-semibold">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar dados do Stand
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* B2B sidebar */}
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-amber-500/10 to-zinc-900 border-amber-500/30">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-white">Subscrição</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{planLabel}</p>
                  {dealerActiveUntil && dealerPlan !== "free" && (
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Renova em {new Date(dealerActiveUntil).toLocaleDateString("pt-PT")}
                    </p>
                  )}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                  <Link to="/market/dealer-dashboard">Gerir plano</Link>
                </Button>
              </CardContent>
            </Card>

            {dealerSlug && (
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Globe className="w-4 h-4 text-amber-400" /> Página pública
                  </div>
                  <p className="text-xs text-zinc-400 break-all">/market/stand/{dealerSlug}</p>
                  <Button asChild size="sm" variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    <Link to={`/market/stand/${dealerSlug}`} target="_blank">
                      <ExternalLink className="w-3 h-3 mr-1" /> Ver
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="bg-zinc-900/40 border-zinc-800">
              <CardContent className="pt-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Conta empresarial: comissão reduzida de 1% por venda e inspeções obrigatórias por oficina independente — anti-fraude garantido.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </MarketLayout>
    );
  }

  // ============================================================
  // PARTICULAR — original layout
  // ============================================================
  return (
    <MarketLayout>
      <h1 className="text-2xl font-bold mb-6">{t("profile.title")}</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("profile.personal")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("profile.email")}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{email}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="name">{t("profile.name")}</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder={t("profile.namePh")} />
              </div>
              <div>
                <Label htmlFor="phone">{t("profile.phone")}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351..." className="pl-9" />
                </div>
              </div>
              <div>
                <Label htmlFor="location">{t("profile.location")}</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder={t("profile.locationPh")} className="pl-9" />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {t("profile.save")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("profile.status")}</span>
                {verified ? (
                  <Badge className="bg-green-100 text-green-800">
                    <ShieldCheck className="h-3 w-3 mr-1" /> {t("profile.verified")}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t("profile.notVerified")}</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("profile.listingsCount")}</span>
                <span className="font-semibold">{stats.listings}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("profile.soldCount")}</span>
                <span className="font-semibold">{stats.sold}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("profile.inspCount")}</span>
                <span className="font-semibold">{stats.inspections}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">
                {t("profile.verifyNote")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketLayout>
  );
}
