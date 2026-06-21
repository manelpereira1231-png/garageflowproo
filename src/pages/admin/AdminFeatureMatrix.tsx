/**
 * Admin: Feature × Plan matrix editor.
 *
 * Lets the super admin toggle which functionality is available in
 * each plan (free / pro / garage). Writes go to `plan_features`,
 * realtime propagates to every connected client, menus and route
 * guards update without a deploy.
 *
 * Core features (is_core = true) are read-only — they cannot be
 * disabled at any plan tier.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/hooks/use-toast";
import { invalidateFeatureCache } from "@/lib/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Plan = "free" | "pro" | "garage";

type FeatureRow = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  is_core: boolean;
};

type MatrixRow = {
  plan_slug: Plan;
  feature_slug: string;
  enabled: boolean;
};

const PLANS: Plan[] = ["free", "pro", "garage"];

export default function AdminFeatureMatrix() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: feats }, { data: mat }] = await Promise.all([
        supabase.from("features").select("*").order("category").order("name"),
        supabase.from("plan_features").select("plan_slug, feature_slug, enabled"),
      ]);
      setFeatures((feats as any) ?? []);
      setMatrix((mat as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const by: Record<string, FeatureRow[]> = {};
    for (const f of features) {
      (by[f.category] ||= []).push(f);
    }
    return by;
  }, [features]);

  const isEnabled = (plan: Plan, slug: string) =>
    matrix.find((r) => r.plan_slug === plan && r.feature_slug === slug)?.enabled ?? false;

  async function toggle(plan: Plan, slug: string, next: boolean) {
    const key = `${plan}:${slug}`;
    setSaving(key);
    // Optimistic
    setMatrix((m) => {
      const i = m.findIndex((r) => r.plan_slug === plan && r.feature_slug === slug);
      if (i >= 0) {
        const copy = [...m];
        copy[i] = { ...copy[i], enabled: next };
        return copy;
      }
      return [...m, { plan_slug: plan, feature_slug: slug, enabled: next }];
    });
    const { error } = await supabase
      .from("plan_features")
      .upsert(
        { plan_slug: plan, feature_slug: slug, enabled: next },
        { onConflict: "plan_slug,feature_slug" }
      );
    setSaving(null);
    if (error) {
      toast({ title: "Erro a guardar", description: error.message, variant: "destructive" });
      // revert
      setMatrix((m) =>
        m.map((r) =>
          r.plan_slug === plan && r.feature_slug === slug ? { ...r, enabled: !next } : r
        )
      );
      return;
    }
    invalidateFeatureCache();
  }

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Definições
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Matriz de Funcionalidades</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Controla o que cada plano disponibiliza. Alterações são aplicadas em tempo real a
          todos os utilizadores. Funcionalidades core (cadeado) estão sempre disponíveis.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        Object.entries(grouped).map(([category, rows]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize">{category}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-medium">Funcionalidade</th>
                      {PLANS.map((p) => (
                        <th key={p} className="text-center p-3 font-medium capitalize w-24">
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => (
                      <tr key={f.slug} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{f.name}</span>
                            {f.is_core && (
                              <Badge variant="secondary" className="gap-1">
                                <Lock className="w-3 h-3" /> core
                              </Badge>
                            )}
                          </div>
                          {f.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {f.description}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                            {f.slug}
                          </div>
                        </td>
                        {PLANS.map((p) => {
                          const checked = f.is_core ? true : isEnabled(p, f.slug);
                          const busy = saving === `${p}:${f.slug}`;
                          return (
                            <td key={p} className="p-3 text-center">
                              <Switch
                                checked={checked}
                                disabled={f.is_core || busy}
                                onCheckedChange={(v) => toggle(p, f.slug, v)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
