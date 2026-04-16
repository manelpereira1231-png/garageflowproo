import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  shopId: string;
  shopName?: string;
  inspectionId?: string;
  currentUserId?: string | null;
  canReview?: boolean;
}

export default function ShopReviews({ shopId, shopName, inspectionId, currentUserId, canReview }: Props) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [avg, setAvg] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, [shopId]);

  const load = async () => {
    const { data } = await supabase
      .from("shop_reviews" as any)
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data as any[]) || [];
    setReviews(list);
    if (list.length) setAvg(list.reduce((s, r) => s + r.rating, 0) / list.length);
  };

  const submit = async () => {
    if (!currentUserId) { toast.error("Inicie sessão para avaliar."); return; }
    if (!rating) { toast.error("Escolha uma classificação."); return; }
    setSubmitting(true);
    const { error } = await supabase.from("shop_reviews" as any).insert({
      shop_id: shopId,
      reviewer_id: currentUserId,
      inspection_id: inspectionId || null,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Apenas compradores com transação concluída podem avaliar esta oficina.");
      return;
    }
    toast.success("Obrigado pela sua avaliação!");
    setRating(0); setComment(""); setShowForm(false);
    load();
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              Avaliações {shopName ? `de ${shopName}` : "da oficina"}
            </h3>
            {reviews.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {avg.toFixed(1)}/5 · {reviews.length} avaliação{reviews.length !== 1 ? "ões" : ""} verificada{reviews.length !== 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Sem avaliações ainda</p>
            )}
          </div>
          {canReview && !showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Avaliar
            </Button>
          )}
        </div>

        {showForm && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`h-6 w-6 transition-colors ${n <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40"}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Como foi a sua experiência com esta oficina? (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={submitting || !rating}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Publicar avaliação"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setRating(0); setComment(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {reviews.map((r) => (
              <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3 w-3 ${n <= r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {new Date(r.created_at).toLocaleDateString("pt-PT")}
                  </span>
                  <span className="text-[10px] text-green-600 font-medium ml-1">· Compra verificada</span>
                </div>
                {r.comment && <p className="text-sm text-foreground/90">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
