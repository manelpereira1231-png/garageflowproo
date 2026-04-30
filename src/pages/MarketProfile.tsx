import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Phone, MapPin, Mail, ShieldCheck, Save, Loader2 } from "lucide-react";
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth"); return; }

    setEmail(user.email || "");

    // Seller profile
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
    } else {
      setName(user.user_metadata?.name || "");
      setPhone(user.user_metadata?.phone || "");
      setLocation(user.user_metadata?.location || "");
    }

    // Stats
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

      if (profileExists) {
        const { error } = await supabase
          .from("carity_seller_profiles")
          .update({ name, phone, location })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("carity_seller_profiles")
          .insert({ user_id: user.id, name, phone, location });
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
      <MarketLayout>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </MarketLayout>
    );
  }

  return (
    <MarketLayout>
      <h1 className="text-2xl font-bold mb-6">{t("profile.title")}</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Profile form */}
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

        {/* Stats sidebar */}
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
