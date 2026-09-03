import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Search, Save, RotateCcw, Sparkles, Lock, Unlock, Loader2 } from "lucide-react";
import { invalidateShopOverrides } from "@/hooks/useShopOverrides";
import { formatLimitValue } from "@/components/plans/PlanLimitsList";
import { logAudit } from "@/lib/auditLog";

/**
 * Exceções por oficina — permite ao Admin ligar/desligar funcionalidades e
 * redefinir limites APENAS para esta oficina, por cima do plano.
 * Tudo o que aqui é gravado reflete-se na app da oficina em tempo real.
 */

type Tri = "inherit" | "on" | "off";

interface FeatureRow { slug: string; name: string; category: string; is_core: boolean; }
interface LimitDef { key: string; label: string; unit: string | null; category: string; sort_order: number; }

interface Props { shopId: string; shopName?: string; }

export function ShopOverridesPanel({ shopId, shopName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [limitDefs, setLimitDefs] = useState<LimitDef[]>([]);
  const [planSlug, setPlanSlug] = useState<string>("");
  const [planName, setPlanName] = useState<string>("");
  const [planLimits, setPlanLimits] = useState<Record<string, number | boolean>>({});
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>({});
  const [featOverrides, setFeatOverrides] = useState<Record<string, boolean>>({});
  const [limitOverrides, setLimitOverrides] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: sub } = await supabase
        .from("subscriptions").select("plan").eq("shop_id", shopId).maybeSingle();
      const slug = (sub as any)?.plan ?? "";
      const [featRes, limitRes, planRes, matrixRes, ovRes] = await Promise.all([
        supabase.from("features").select("slug,name,category,is_core").eq("active", true),
        supabase.from("plan_limits_catalog" as any).select("key,label,unit,category,sort_order").order("sort_order"),
        slug ? supabase.from("plans" as any).select("name,limits").eq("slug", slug).maybeSingle() : Promise.resolve({ data: null } as any),
        slug ? supabase.from("plan_features").select("feature_slug,enabled").eq("plan_slug", slug) : Promise.resolve({ data: [] } as any),
        supabase.from("shop_overrides" as any).select("features,limits,notes").eq("shop_id", shopId).maybeSingle(),
      ]);
      if (cancelled) return;
      setPlanSlug(slug);
      setPlanName(((planRes as any)?.data?.name as string) ?? slug);
      setPlanLimits((((planRes as any)?.data?.limits) ?? {}) as Record<string, number | boolean>);
      setPlanFeatures(Object.fromEntries(((matrixRes as any)?.data ?? []).map((r: any) => [r.feature_slug, !!r.enabled])));
      setFeatures((((featRes.data ?? []) as any) as FeatureRow[]).filter((f) => !f.is_core)
        .sort((a, b) => a.name.localeCompare(b.name)));
      setLimitDefs(((limitRes as any)?.data ?? []) as LimitDef[]);
      const ov: any = (ovRes as any)?.data ?? {};
      setFeatOverrides((ov.features ?? {}) as Record<string, boolean>);
      setLimitOverrides(Object.fromEntries(Object.entries((ov.limits ?? {}) as Record<string, number>)
        .map(([k, v]) => [k, String(v)])));
      setNotes(ov.notes ?? "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features.filter((f) => !q || f.name.toLowerCase().includes(q) || f.slug.includes(q));
  }, [features, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureRow[]>();
    filtered.forEach((f) => {
      const k = f.category || "Outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const triFor = (slug: string): Tri =>
    featOverrides[slug] === undefined ? "inherit" : featOverrides[slug] ? "on" : "off";

  const setTri = (slug: string, tri: Tri) => {
    setFeatOverrides((prev) => {
      const next = { ...prev };
      if (tri === "inherit") delete next[slug];
      else next[slug] = tri === "on";
      return next;
    });
  };

  const overrideCount = Object.keys(featOverrides).length + Object.keys(limitOverrides).length;

  const save = async () => {
    setSaving(true);
    const limits: Record<string, number> = {};
    Object.entries(limitOverrides).forEach(([k, v]) => {
      const s = String(v).trim();
      if (s === "") return;
      const n = Number(s);
      if (!Number.isFinite(n)) return;
      limits[k] = Math.trunc(n);
    });
    const { error } = await supabase.from("shop_overrides" as any).upsert({
      shop_id: shopId,
      features: featOverrides,
      limits,
      notes: notes.trim() || null,
    }, { onConflict: "shop_id" });
    setSaving(false);
    if (error) { toast.error("Não foi possível guardar: " + error.message); return; }
    invalidateShopOverrides(shopId);
    void logAudit({
      action: "shop_overrides_updated",
      entityType: "shop",
      entityId: shopId,
      details: { features: featOverrides, limits, shop: shopName },
    });
    toast.success("Exceções aplicadas — a oficina vê já as alterações.");
  };

  const resetAll = () => { setFeatOverrides({}); setLimitOverrides({}); };

  if (loading) {
    return (
      <Card><CardContent className="py-12 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar exceções…
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Exceções desta oficina
              </CardTitle>
              <CardDescription>
                Plano atual: <strong>{planName || "—"}</strong>. Tudo o que alterares aqui aplica-se
                <strong> apenas a esta oficina</strong> e sobrepõe-se ao plano, em tempo real.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={overrideCount ? "default" : "secondary"}>
                {overrideCount} exceção{overrideCount === 1 ? "" : "ões"}
              </Badge>
              <Button variant="outline" size="sm" onClick={resetAll} disabled={!overrideCount}>
                <RotateCcw className="h-4 w-4 mr-1" /> Repor plano
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Guardar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Limites personalizados</CardTitle>
          <CardDescription>
            Deixa vazio para herdar o plano. Usa <code>-1</code> para ilimitado e <code>0</code> para bloquear.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {limitDefs.length === 0 && (
            <p className="text-sm text-muted-foreground">Catálogo de limites vazio.</p>
          )}
          {limitDefs.map((l) => {
            const planValue = planLimits[l.key];
            const dirty = limitOverrides[l.key] !== undefined && limitOverrides[l.key] !== "";
            return (
              <div key={l.key} className={`rounded-lg border p-3 space-y-2 transition-colors ${dirty ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">{l.label}</Label>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Plano: {formatLimitValue(planValue as any, l.unit)}
                  </span>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Herdar do plano"
                  value={limitOverrides[l.key] ?? ""}
                  onChange={(e) => setLimitOverrides((p) => {
                    const next = { ...p };
                    if (e.target.value === "") delete next[l.key];
                    else next[l.key] = e.target.value;
                    return next;
                  })}
                  className="h-9"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Funcionalidades</CardTitle>
              <CardDescription>Ativa ou bloqueia módulos só para esta oficina.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar funcionalidade…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {grouped.length === 0 && <p className="text-sm text-muted-foreground">Sem resultados.</p>}
          {grouped.map(([category, rows], gi) => (
            <div key={category} className="space-y-2">
              {gi > 0 && <Separator />}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">{category}</p>
              <div className="grid gap-2 lg:grid-cols-2">
                {rows.map((f) => {
                  const tri = triFor(f.slug);
                  const inPlan = !!planFeatures[f.slug];
                  return (
                    <div
                      key={f.slug}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors ${
                        tri === "on" ? "border-success/50 bg-success/5"
                        : tri === "off" ? "border-destructive/50 bg-destructive/5"
                        : "border-border"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          {inPlan ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {inPlan ? "Incluído no plano" : "Bloqueado no plano"}
                        </p>
                      </div>
                      <div className="flex rounded-md border overflow-hidden shrink-0">
                        {(["off", "inherit", "on"] as Tri[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setTri(f.slug, opt)}
                            className={`px-2.5 py-1 text-xs transition-colors ${
                              tri === opt
                                ? opt === "on" ? "bg-success text-success-foreground"
                                  : opt === "off" ? "bg-destructive text-destructive-foreground"
                                  : "bg-muted text-foreground"
                                : "hover:bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            {opt === "on" ? "Ativar" : opt === "off" ? "Bloquear" : "Plano"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nota interna</CardTitle>
          <CardDescription>Porque é que esta oficina tem exceções (visível só no Admin).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: cliente piloto com acesso antecipado ao módulo de Marketing."
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar exceções
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ShopOverridesPanel;
