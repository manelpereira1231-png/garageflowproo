/**
 * Admin · Planos
 *
 * Edita metadados de cada plano (nome, descrição, estado ativo, ordem).
 * Os PREÇOS por país × ciclo são geridos em /admin/countries (já com sync Stripe).
 * Esta página é a fonte de verdade do nome/descrição que aparece na landing,
 * checkout, billing, etc. — nada hardcoded.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Globe, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface PlanRow {
  slug: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error("Erro ao carregar planos: " + error.message);
    setPlans((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-plans")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const save = async (p: PlanRow) => {
    setSaving(p.slug);
    const { error } = await supabase
      .from("plans")
      .update({
        name: p.name,
        description: p.description,
        active: p.active,
        sort_order: p.sort_order,
      })
      .eq("slug", p.slug);
    setSaving(null);
    if (error) return toast.error("Erro ao guardar: " + error.message);
    toast.success(`Plano ${p.name} atualizado — propagado para toda a app`);
    try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch {}
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Admin</Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Planos</h1>
              <p className="text-sm text-muted-foreground">Nome, descrição e estado de cada plano. Editável e sem hardcode.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/countries">
              <Button variant="outline" size="sm"><Globe className="w-4 h-4 mr-2" />Preços por país (Stripe)</Button>
            </Link>
            <Link to="/admin/features">
              <Button variant="outline" size="sm"><ListChecks className="w-4 h-4 mr-2" />Funcionalidades por plano</Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((p) => (
              <Card key={p.slug}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{p.slug}</Badge>
                      {p.name}
                    </CardTitle>
                    <CardDescription>
                      Editar metadados deste plano. Os preços vivem em <Link to="/admin/countries" className="underline">Países</Link>.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${p.slug}`} className="text-xs">Ativo</Label>
                    <Switch
                      id={`active-${p.slug}`}
                      checked={p.active}
                      onCheckedChange={(v) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, active: v } : x))}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Label className="text-xs">Nome de exibição</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, name: e.target.value } : x))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Ordem</Label>
                      <Input
                        type="number"
                        value={p.sort_order}
                        onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, sort_order: Number(e.target.value) } : x))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Textarea
                      rows={2}
                      value={p.description ?? ""}
                      onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, description: e.target.value } : x))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => save(p)} disabled={saving === p.slug}>
                      {saving === p.slug ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
