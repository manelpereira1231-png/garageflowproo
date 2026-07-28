/**
 * Client testimonial submission — accessible from Settings by the shop owner.
 * Each shop can have one pending or approved review at a time (DB constraint).
 * All submissions start as `status='pending'` and must be admin-approved
 * before appearing on the public landing.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Existing = { id: string; status: string; rating: number; content: string; created_at: string };

export default function SettingsTestimonials() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const shopId = useActiveShopId();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [displayPublicly, setDisplayPublicly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadExisting() {
    if (!shopId) { setLoading(false); return; }
    const { data } = await supabase
      .from("testimonials" as any)
      .select("id, status, rating, content, created_at")
      .eq("shop_id", shopId)
      .in("status", ["pending", "approved"])
      .maybeSingle();
    setExisting((data as unknown as Existing) || null);
    setLoading(false);
  }
  useEffect(() => { void loadExisting(); /* eslint-disable-next-line */ }, [shopId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    if (content.trim().length < 20 || content.length > 400) {
      toast({ title: "20–400 caracteres", variant: "destructive" }); return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("testimonials" as any).insert({
      shop_id: shopId,
      submitted_by: user?.id,
      author_name: authorName.trim(),
      workshop_name: workshopName.trim() || null,
      rating,
      content: content.trim(),
      status: "pending",
      featured: false,
      display_publicly: displayPublicly,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast({ title: t("testimonials.duplicate"), variant: "destructive" });
      else toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("testimonials.submitted") });
    setContent(""); setAuthorName(""); setWorkshopName("");
    void loadExisting();
  }

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (existing) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">{t("testimonials.leaveTitle")}</h1>
        <div className="rounded-xl border p-5 space-y-3">
          <Badge variant={existing.status === "approved" ? "default" : "secondary"}>
            {t(`testimonials.${existing.status}`)}
          </Badge>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < existing.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            ))}
          </div>
          <p className="text-sm italic">"{existing.content}"</p>
          <p className="text-xs text-muted-foreground">{new Date(existing.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("testimonials.leaveTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("testimonials.leaveSubtitle")}</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
        <div>
          <Label>{t("testimonials.rating")}</Label>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={`w-6 h-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{t("testimonials.authorName")}</Label>
          <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} required maxLength={120} />
        </div>
        <div>
          <Label>{t("testimonials.workshopName")}</Label>
          <Input value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} maxLength={160} />
        </div>
        <div>
          <Label>{t("testimonials.content")}</Label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} required maxLength={400} />
          <p className="text-xs text-muted-foreground mt-1">{t("testimonials.contentHint")} ({content.length}/400)</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={displayPublicly} onCheckedChange={(v) => setDisplayPublicly(!!v)} className="mt-0.5" />
          <span>{t("testimonials.displayPublicly")}</span>
        </label>
        <Button type="submit" disabled={submitting || !authorName || content.trim().length < 20}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {t("testimonials.submit")}
        </Button>
      </form>
    </div>
  );
}
