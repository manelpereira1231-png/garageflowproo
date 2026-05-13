import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, LifeBuoy, Clock, ShieldCheck } from "lucide-react";
import { useSupportI18n } from "@/i18n/supportI18n";

export default function Support() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialContext = params.get("context") === "market" ? "market" : "erp";
  const t = useSupportI18n();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    context: initialContext,
    category: "general",
    priority: "normal",
    subject: "",
    message: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setForm((f) => ({
          ...f,
          email: user.email ?? f.email,
          name: (user.user_metadata?.full_name as string) ?? f.name,
        }));
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim() || !form.email.trim()) {
      toast.error(t("fillRequired"));
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const ticketId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;

    const payload: Record<string, any> = {
      user_id: user?.id ?? null,
      contact_email: form.email,
      contact_name: form.name || null,
      contact_phone: form.phone || null,
      context: form.context,
      category: form.category,
      priority: form.priority,
      subject: form.subject,
      message: form.message,
    };
    if (ticketId) payload.id = ticketId;

    // No .select() — RLS doesn't allow anon to read back the inserted row.
    const { error } = await supabase
      .from("support_tickets" as any)
      .insert(payload);

    if (error) {
      console.error("support_tickets insert failed:", error);
      setLoading(false);
      toast.error(t("errorSend"));
      return;
    }

    // Notify admin by email — non-blocking
    supabase.functions.invoke("notify-support-ticket", {
      body: {
        ticket_id: ticketId,
        contact_email: form.email,
        contact_name: form.name || null,
        contact_phone: form.phone || null,
        context: form.context,
        category: form.category,
        priority: form.priority,
        subject: form.subject,
        message: form.message,
      },
    }).catch((err) => console.warn("notify-support-ticket failed:", err));

    setLoading(false);
    toast.success(t("success"));
    setForm((f) => ({ ...f, subject: "", message: "" }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("back")}
          </Button>
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">{t("title")}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitle")}</CardTitle>
              <CardDescription>{t("cardDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("name")}</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("namePh")} />
                  </div>
                  <div>
                    <Label>{t("email")}</Label>
                    <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("emailPh")} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("phone")}</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+351 ..." />
                  </div>
                  <div>
                    <Label>{t("platform")}</Label>
                    <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="erp">{t("erp")}</SelectItem>
                        <SelectItem value="market">{t("market")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("category")}</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{t("cat_general")}</SelectItem>
                        <SelectItem value="billing">{t("cat_billing")}</SelectItem>
                        <SelectItem value="bug">{t("cat_bug")}</SelectItem>
                        <SelectItem value="account">{t("cat_account")}</SelectItem>
                        <SelectItem value="kyc">{t("cat_kyc")}</SelectItem>
                        <SelectItem value="inspection">{t("cat_inspection")}</SelectItem>
                        <SelectItem value="dispute">{t("cat_dispute")}</SelectItem>
                        <SelectItem value="rgpd">{t("cat_rgpd")}</SelectItem>
                        <SelectItem value="other">{t("cat_other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("priority")}</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t("p_low")}</SelectItem>
                        <SelectItem value="normal">{t("p_normal")}</SelectItem>
                        <SelectItem value="high">{t("p_high")}</SelectItem>
                        <SelectItem value="urgent">{t("p_urgent")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t("subject")}</Label>
                  <Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t("subjectPh")} />
                </div>
                <div>
                  <Label>{t("message")}</Label>
                  <Textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t("messagePh")} />
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? t("sending") : t("send")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("howTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{t("howResponse")}</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{t("howRgpd")}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("resources")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a href="/legal/my-data" className="block hover:text-primary">{t("rMyData")}</a>
              <a href="/legal/privacy" className="block hover:text-primary">{t("rPrivacy")}</a>
              <a href="/legal/terms" className="block hover:text-primary">{t("rTerms")}</a>
              <a href="/legal/market-terms" className="block hover:text-primary">{t("rMarketTerms")}</a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
