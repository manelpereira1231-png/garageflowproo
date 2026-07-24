import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";

export default function SupplierReviews() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<any[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = async () => {
    if (!supplierId) return;
    const { data } = await supabase.from("gsn_reviews" as any)
      .select("id,rating_overall,comment,reply,created_at")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };

  useEffect(() => { load(); }, [supplierId]);

  const saveReply = async (id: string) => {
    const { error } = await supabase.from("gsn_reviews" as any).update({ reply: replies[id] }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resposta guardada");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avaliações</h1>
        <p className="text-sm text-muted-foreground">Feedback das oficinas compradoras.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Avaliações ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem avaliações.</p> :
            rows.map(r => (
              <div key={r.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < (r.rating_overall ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  ))}
                </div>
                {r.comment && <p className="text-sm">{r.comment}</p>}
                {r.reply ? (
                  <p className="text-xs bg-muted p-2 rounded">Resposta: {r.reply}</p>
                ) : (
                  <div className="flex gap-2">
                    <Textarea rows={2} placeholder="Escreva uma resposta..." value={replies[r.id] ?? ""} onChange={(e) => setReplies(s => ({ ...s, [r.id]: e.target.value }))} />
                    <Button size="sm" onClick={() => saveReply(r.id)} disabled={!replies[r.id]}>Responder</Button>
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
