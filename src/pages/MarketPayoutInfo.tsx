import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Euro, Banknote, ShieldCheck, FileText, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useCountryPricing } from "@/hooks/useCountryPricing";
import { useMarketT } from "@/i18n/marketTranslations";

/**
 * Transparent breakdown of how partner workshops earn and receive money
 * from GarageFlow Market (inspections + commissions). Goal: zero ambiguity.
 * Fully internationalized via the Market i18n dictionary.
 */
export default function MarketPayoutInfo() {
  const { pricing, formatPrice } = useCountryPricing();
  const t = useMarketT();
  const inspectionPrice = formatPrice(pricing.inspection_price);
  const shopShare = formatPrice(pricing.inspection_shop_share);
  const platformShare = formatPrice(pricing.inspection_platform_share);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center space-y-2">
        <Badge className="bg-amber-500 text-slate-900">{t("payout.badge")}</Badge>
        <h1 className="text-3xl font-bold">{t("payout.title")}</h1>
        <p className="text-muted-foreground">{t("payout.subtitle")}</p>
      </div>

      {/* Block 1 — Inspections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-amber-500" /> {t("payout.b1.title")} ({inspectionPrice})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>{t("payout.b1.intro", { price: inspectionPrice })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950/20">
              <p className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400">{t("payout.b1.shopReceives")}</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{shopShare}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("payout.b1.perInspection")}</p>
            </div>
            <div className="border rounded-lg p-4 bg-muted/40">
              <p className="text-xs uppercase font-bold text-muted-foreground">{t("payout.b1.platform")}</p>
              <p className="text-3xl font-bold">{platformShare}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("payout.b1.platformCovers")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">{t("payout.b1.warn")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Block 2 — Commission on car sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-500" /> {t("payout.b2.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t("payout.b2.body")}</p>
          <p className="text-muted-foreground text-xs">{t("payout.b2.note")}</p>
        </CardContent>
      </Card>

      {/* Block 3 — How payouts work */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> {t("payout.b3.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center font-bold shrink-0">{n}</div>
                <div>
                  <p className="font-semibold">{t(`payout.b3.s${n}.title`)}</p>
                  <p className="text-muted-foreground text-xs">{t(`payout.b3.s${n}.desc`)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">{t("payout.b3.s4.title")}</p>
                <p className="text-muted-foreground text-xs">{t("payout.b3.s4.desc", { amount: shopShare })}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Block 4 — Required setup */}
      <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" /> {t("payout.b4.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2 list-disc pl-5">
            <li>{t("payout.b4.nif")}</li>
            <li>{t("payout.b4.iban")}</li>
            <li>{t("payout.b4.contact")}</li>
            <li>{t("payout.b4.partner")}</li>
          </ul>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/settings">
              {t("payout.b4.cta")} <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Block 5 — Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> {t("payout.b5.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>{t("payout.b5.p1")}</p>
          <p>{t("payout.b5.p2")}</p>
          <p>
            {t("payout.b5.p3", { terms: "__TERMS__", dpa: "__DPA__" })
              .split("__TERMS__")
              .flatMap((part, i, arr) =>
                i < arr.length - 1
                  ? [part, <Link key={`t${i}`} to="/legal/terms" className="underline">{t("payout.b5.terms")}</Link>]
                  : [part],
              )
              .flatMap((part, i, arr) => {
                if (typeof part !== "string") return [part];
                return part.split("__DPA__").flatMap((sub, j, subArr) =>
                  j < subArr.length - 1
                    ? [sub, <Link key={`d${i}-${j}`} to="/legal/dpa" className="underline">{t("payout.b5.dpa")}</Link>]
                    : [sub],
                );
              })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
