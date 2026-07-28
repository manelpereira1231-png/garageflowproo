/**
 * AdminTestimonials — moderation surface for shop-submitted reviews.
 * Approves, rejects, and toggles `featured` (curated selection for landing).
 * Only rows with status=approved + featured + display_publicly=true are shown
 * publicly (RLS enforced).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Star, Check, X, Loader2 } from "lucide-react";

type Row = {
  id: string;
  shop_id: string;
  author_name: string;
  workshop_name: string | null;
  rating: number;
  content: string;
  status: "pending" | "approved" | "rejected";
  featured: boolean;
  display_publicly: boolean;
  created_at: string;
};

export default function AdminTestimonials() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  async function load() {
    setLoading(true);
    let q = supabase.from("testimonials" as any).select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [filter]);

  async function update(id: string, patch: Partial<Row>) {
    const { error } = await supabase.from("testimonials" as any).update(patch).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    void load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Avaliações</h1>
        <p className="text-sm text-muted-foreground">Aprove, rejeite e escolha as avaliações em destaque na landing page pública.</p>
      </div>

      <div className="flex gap-2">
        {(["pending","approved","rejected","all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovadas" : f === "rejected" ? "Rejeitadas" : "Todas"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl">Sem avaliações neste estado.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    ))}
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                    {r.featured && <Badge variant="outline">⭐ Destaque</Badge>}
                    {!r.display_publicly && <Badge variant="outline">Privado</Badge>}
                  </div>
                  <div className="mt-2 text-sm italic">"{r.content}"</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {r.author_name}{r.workshop_name ? ` · ${r.workshop_name}` : ""} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {r.status !== "approved" && (
                  <Button size="sm" onClick={() => update(r.id, { status: "approved" })}>
                    <Check className="w-4 h-4 mr-1" /> Aprovar
                  </Button>
                )}
                {r.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => update(r.id, { status: "rejected", featured: false })}>
                    <X className="w-4 h-4 mr-1" /> Rejeitar
                  </Button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs">Destaque</span>
                  <Switch
                    checked={r.featured}
                    disabled={r.status !== "approved" || !r.display_publicly}
                    onCheckedChange={(v) => update(r.id, { featured: v })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
