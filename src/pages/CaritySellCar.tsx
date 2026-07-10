import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft, Car, Loader2, Lock } from "lucide-react";
import StructuredPhotoUpload, { getDefaultPhotoSlots, getPhotoUrls, areRequiredPhotosFilled, type PhotoSlot } from "@/components/StructuredPhotoUpload";
import MarketKYCFlow from "@/components/MarketKYCFlow";
import ConnectOnboardingGate from "@/components/ConnectOnboardingGate";
import { useCountryPricing } from "@/hooks/useCountryPricing";
import VehicleMakeModelSelector from "@/components/VehicleMakeModelSelector";
import { useMarketT } from "@/i18n/marketTranslations";
import { listActiveCountries, getCountryCode, getCountryConfig } from "@/lib/regionConfig";
import { getDistanceUnit } from "@/lib/marketPrice";

const FUEL_OPTIONS = ['Gasóleo', 'Gasolina', 'Híbrido', 'Elétrico', 'GPL'];

export default function CaritySellCar() {
  const t = useMarketT();
  const navigate = useNavigate();
  const { pricing, formatPrice } = useCountryPricing();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [connectReady, setConnectReady] = useState(false);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(getDefaultPhotoSlots());

  const activeCountries = listActiveCountries();
  const defaultCountry = getCountryCode();

  const [form, setForm] = useState({
    make: '', model: '', year: new Date().getFullYear(), mileage: 0,
    fuel: 'Gasóleo', plate: '', vin: '', price: 0, description: '',
    country_code: defaultCountry, city: '', region: '',
  });

  const currentCountry = getCountryConfig(form.country_code);
  const distanceUnit = getDistanceUnit(form.country_code);

  const [sellerForm, setSellerForm] = useState({
    name: '', phone: '', location: '',
  });

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("sell.toast.needAccount"));
      navigate("/market/auth?mode=signup&redirect=/market/sell");
      return;
    }
    setUser(user);
    const { data: profile } = await supabase
      .from("carity_seller_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (profile) {
      setSellerProfile(profile);
      setSellerForm({ name: profile.name, phone: profile.phone, location: profile.location });
    }
  };

  const kycApproved = sellerProfile?.kyc_status === "approved";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!kycApproved) { toast.error(t("sell.toast.kycRequired")); return; }
    if (!connectReady) { toast.error(t("sell.toast.connectRequired")); return; }
    if (!form.make || !form.model || !form.price || !form.plate) { toast.error(t("sell.toast.fillRequired")); return; }
    if (!areRequiredPhotosFilled(photoSlots)) { toast.error(t("sell.toast.fillPhotos")); return; }
    if (!sellerForm.name || !sellerForm.phone) { toast.error(t("sell.toast.fillContact")); return; }

    setLoading(true);
    try {
      if (!sellerProfile) {
        await supabase.from("carity_seller_profiles").insert({ user_id: user.id, name: sellerForm.name, phone: sellerForm.phone, location: sellerForm.location });
      } else {
        await supabase.from("carity_seller_profiles").update({ name: sellerForm.name, phone: sellerForm.phone, location: sellerForm.location }).eq("id", sellerProfile.id);
      }

      const photoUrls = getPhotoUrls(photoSlots);
      const { data: listing, error } = await supabase.from("carity_listings").insert({
        seller_id: user.id, make: form.make, model: form.model, year: form.year, mileage: form.mileage,
        fuel: form.fuel, plate: form.plate.toUpperCase(), vin: form.vin || null, price: form.price,
        description: form.description, photos: photoUrls, status: 'pending_payment',
      }).select().single();

      if (error) {
        if (error.message?.includes("VIN_DUPLICATE") || error.code === "23505") {
          throw new Error(t("sell.toast.vinDup"));
        }
        throw error;
      }
      toast.success(t("sell.toast.created"));
      navigate(`/market/pay/${listing.id}`);
    } catch (err: any) {
      toast.error(err.message || t("sell.toast.error"));
    } finally { setLoading(false); }
  };

  const inspectionPrice = formatPrice(pricing.inspection_price);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <Link to="/market">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-1" /> {t("common.back")}
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("sell.title")}</h1>
          <p className="text-muted-foreground">
            {t("sell.subtitle", { price: inspectionPrice })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {user && (
            <MarketKYCFlow
              userId={user.id}
              profile={sellerProfile}
              onComplete={(updated) => setSellerProfile(updated)}
            />
          )}

          {user && kycApproved && (
            <ConnectOnboardingGate
              role="seller"
              returnPath="/market/sell"
              onStatusChange={setConnectReady}
            />
          )}

          <Card>
            <CardHeader><CardTitle className="text-lg">{t("sell.section.seller")}</CardTitle><CardDescription>{t("sell.section.sellerDesc")}</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>{t("sell.field.name")} *</Label><Input value={sellerForm.name} onChange={e => setSellerForm(p => ({ ...p, name: e.target.value }))} placeholder={t("sell.field.namePh")} /></div>
              <div><Label>{t("sell.field.phone")} *</Label><Input value={sellerForm.phone} onChange={e => setSellerForm(p => ({ ...p, phone: e.target.value }))} placeholder="+351 9XX XXX XXX" /></div>
              <div><Label>{t("sell.field.location")}</Label><Input value={sellerForm.location} onChange={e => setSellerForm(p => ({ ...p, location: e.target.value }))} placeholder={t("sell.field.locationPh")} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">{t("sell.section.vehicle")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VehicleMakeModelSelector
                  make={form.make}
                  model={form.model}
                  onMakeChange={(v) => setForm(p => ({ ...p, make: v }))}
                  onModelChange={(v) => setForm(p => ({ ...p, model: v }))}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><Label>{t("sell.field.year")} *</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) || 2020 }))} /></div>
                <div><Label>{t("sell.field.mileage")} *</Label><Input type="number" value={form.mileage} onChange={e => setForm(p => ({ ...p, mileage: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label>{t("sell.field.fuel")} *</Label>
                  <Select value={form.fuel} onValueChange={v => setForm(p => ({ ...p, fuel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FUEL_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="col-span-2 md:col-span-3"><Label>{t("sell.field.plate")} *</Label><Input value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value }))} placeholder="AA-00-BB" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t("sell.field.vin")}</Label><Input value={form.vin} onChange={e => setForm(p => ({ ...p, vin: e.target.value }))} placeholder={t("sell.field.vinPh")} /></div>
                <div><Label>{t("sell.field.price", { sym: pricing.currency_symbol })} *</Label><Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div><Label>{t("sell.field.description")}</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t("sell.field.descriptionPh")} rows={4} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("sell.section.photos")}</CardTitle>
              <CardDescription>{t("sell.section.photosDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {user && (
                <StructuredPhotoUpload
                  userId={user.id}
                  photos={photoSlots}
                  onChange={setPhotoSlots}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-8 w-8 text-amber-500" />
                <div>
                  <h3 className="font-semibold">{t("sell.fee.title", { price: inspectionPrice })}</h3>
                  <p className="text-sm text-muted-foreground">{t("sell.fee.desc")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold disabled:opacity-60" disabled={loading || !kycApproved || !connectReady}>
            {!kycApproved || !connectReady ? <Lock className="h-4 w-4 mr-2" /> : loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Car className="h-4 w-4 mr-2" />}
            {!kycApproved ? t("sell.cta.kyc") : !connectReady ? t("sell.cta.connect") : t("sell.cta.submit", { price: inspectionPrice })}
          </Button>
        </form>
      </div>
    </div>
  );
}
