import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, CreditCard, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMarketT } from "@/i18n/marketTranslations";

interface CountryPricing {
  code: string;
  currency: string;
  currency_symbol: string;
  inspection_price: number;
  locale: string;
}

export default function CarityPayInspection() {
  const t = useMarketT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [country, setCountry] = useState<CountryPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    const [{ data: listingData }, { data: { user } }] = await Promise.all([
      supabase.from("carity_listings").select("*").eq("id", id).single(),
      supabase.auth.getUser(),
    ]);
    setListing(listingData);

    let countryCode = "PT";
    if (user) {
      const { data: profile } = await supabase
        .from("carity_seller_profiles")
        .select("country_code").eq("user_id", user.id).maybeSingle();
      if (profile?.country_code) countryCode = profile.country_code;
    }
    if (countryCode === "PT") {
      try {
        const { getCountryCode } = await import("@/lib/regionConfig");
        const detected = getCountryCode();
        if (detected) countryCode = detected;
      } catch { /* keep PT */ }
    }

    const { data: countryData } = await supabase
      .from("country_settings")
      .select("code, currency, currency_symbol, inspection_price, locale")
      .eq("code", countryCode).eq("active", true).maybeSingle();

    setCountry(countryData as any || {
      code: "PT", currency: "EUR", currency_symbol: "€",
      inspection_price: 29.90, locale: "pt-PT",
    });
    setLoading(false);
  };

  const formatPrice = (value: number) => {
    if (!country) return `€${value.toFixed(2)}`;
    return new Intl.NumberFormat(country.locale, {
      style: "currency", currency: country.currency,
      minimumFractionDigits: country.currency === "INR" ? 0 : 2,
    }).format(value);
  };

  const handlePayment = async () => {
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("pay.expired")); navigate("/auth"); return; }
      const res = await supabase.functions.invoke("carity-pay-inspection", { body: { listing_id: id } });
      if (res.error) throw new Error(res.error.message);
      const { url } = res.data;
      if (url) { window.location.href = url; } else { throw new Error("URL"); }
    } catch (err: any) { toast.error(err.message || t("pay.error")); setPaying(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>;
  if (!listing) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><p className="text-lg">{t("pay.notFound")}</p><Link to="/market"><Button>{t("common.back")}</Button></Link></div>;
  if (listing.status !== 'pending_payment') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <CheckCircle className="h-16 w-16 text-amber-500" />
      <h2 className="text-xl font-semibold">{t("pay.alreadyPaid.title")}</h2>
      <p className="text-muted-foreground">{t("pay.alreadyPaid.desc")}</p>
      <Link to="/market"><Button>{t("pay.viewMarket")}</Button></Link>
    </div>
  );

  const price = country?.inspection_price ?? 29.90;
  const steps = [t("pay.step1"), t("pay.step2"), t("pay.step3"), t("pay.step4")];

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          {country && <span className="text-xs text-amber-400">{country.code} · {country.currency}</span>}
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <CardTitle className="text-xl">{t("pay.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">{listing.make} {listing.model} ({listing.year})</h3>
              <p className="text-sm text-muted-foreground">{t("pay.plate")}: {listing.plate}</p>
              <p className="text-sm text-muted-foreground">{t("pay.price")}: {formatPrice(listing.price)}</p>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span>{t("pay.fee")}</span>
                <span className="font-semibold">{formatPrice(price)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("pay.feeDesc")}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">{t("pay.next")}</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {steps.map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="bg-amber-100 text-amber-700 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold dark:bg-amber-900/30 dark:text-amber-400">{i + 1}</span>
                    {text}
                  </li>
                ))}
              </ol>
            </div>

            <Button onClick={handlePayment} disabled={paying} size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              {t("pay.cta", { price: formatPrice(price) })}
            </Button>

            <p className="text-xs text-center text-muted-foreground">{t("pay.secure")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
