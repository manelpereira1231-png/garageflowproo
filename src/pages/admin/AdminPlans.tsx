/**
 * Admin · Planos (dinâmico)
 *
 * Gestor completo — criar/editar/duplicar/arquivar/restaurar planos e as
 * suas configurações visuais + preços por país × ciclo, sem alterar código.
 *
 * Fonte de verdade:
 *   - `plans` (metadata + visibilidade)
 *   - `plan_country_prices` (preço + Stripe IDs por país × ciclo)
 *   - `plan_features` (funcionalidades por plano — gerido em /admin/features)
 *
 * Retrocompatível: as colunas antigas de country_settings.saas_ / stripe_
 * continuam a existir e são mantidas em sincronia por um trigger DB.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Globe, ListChecks, Plus, Copy, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Cycle = "monthly" | "yearly" | "quarterly" | "semestral" | "lifetime";

interface PlanRow {
  slug: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  color: string | null;
  icon: string | null;
  label: string | null;
  visible_on_landing: boolean;
  visible_on_billing: boolean;
  visible_on_checkout: boolean;
  visible_on_compare: boolean;
  archived_at: string | null;
  limits: Record<string, number | boolean> | null;
  cta_mode: "checkout" | "trial" | "demo" | "contact" | "unavailable" | "custom_url";
  cta_label: string | null;
  cta_url: string | null;
  badge_label: string | null;
  show_button: boolean;
  show_price: boolean;
  show_trial: boolean;
  show_badge: boolean;
}

interface LimitCatalogRow {
  key: string;
  label: string;
  description: string | null;
  unit: string;
  category: string;
  sort_order: number;
  allow_unlimited: boolean;
}


interface PriceRow {
  id: string;
  plan_slug: string;
  country_code: string;
  cycle: Cycle;
  currency: string;
  amount: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  active: boolean;
}

interface CountryRow {
  code: string;
  name: string;
  currency: string;
  currency_symbol: string;
}

const CYCLES: Cycle[] = ["monthly", "yearly", "quarterly", "semestral", "lifetime"];

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({ slug: "", name: "", description: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const [limitsCatalog, setLimitsCatalog] = useState<LimitCatalogRow[]>([]);

  // ── Dirty-tracking so realtime reloads don't wipe unsaved edits ──
  // `serverSnapshotRef` holds the last known server rows keyed by slug. A slug
  // is considered dirty when the local row differs from the snapshot. Any
  // reload merges the incoming server rows in only for non-dirty slugs. Save
  // handlers refresh the snapshot for their slug so subsequent reloads adopt
  // the persisted server value.
  const serverSnapshotRef = useRef<Map<string, PlanRow>>(new Map());
  const dirtyRef = useRef<Set<string>>(new Set());
  const clearDirty = (slug: string) => { dirtyRef.current.delete(slug); };
  const isDirty = (local: PlanRow | undefined, server: PlanRow | undefined) => {
    if (!local || !server) return false;
    // Compare only the fields the editor mutates (avoid noisy timestamps).
    const keys: (keyof PlanRow)[] = [
      "name","description","active","sort_order","color","icon","label",
      "visible_on_landing","visible_on_billing","visible_on_checkout","visible_on_compare",
      "cta_mode","cta_label","cta_url","badge_label",
      "show_button","show_price","show_trial","show_badge",
    ];
    for (const k of keys) {
      if ((local as any)[k] !== (server as any)[k]) return true;
    }
    // Deep-compare limits jsonb
    try {
      if (JSON.stringify(local.limits ?? {}) !== JSON.stringify(server.limits ?? {})) return true;
    } catch { /* noop */ }
    return false;
  };


  const load = async () => {
    setLoading(true);
    const [plansRes, pricesRes, countriesRes, catalogRes] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order", { ascending: true }),
      supabase.from("plan_country_prices" as any).select("*"),
      supabase.from("country_settings").select("code,name,currency,currency_symbol").eq("active", true).order("name"),
      supabase.from("plan_limits_catalog" as any).select("*").order("sort_order", { ascending: true }),
    ]);
    if (plansRes.error) toast.error("Erro ao carregar planos: " + plansRes.error.message);

    const serverPlans = ((plansRes.data as any) ?? []) as PlanRow[];

    // Refresh dirty set: a slug is dirty when local edit differs from the
    // last known server row for that slug (auto-detected, no need to touch
    // every setPlans call site).
    setPlans((prev) => {
      const prevBySlug = new Map(prev.map((p) => [p.slug, p]));
      const serverBySlug = new Map(serverPlans.map((p) => [p.slug, p]));

      // Recompute dirty against the previous snapshot to catch anything the
      // user changed but hasn't saved yet.
      const nextDirty = new Set<string>();
      for (const [slug, local] of prevBySlug) {
        const snap = serverSnapshotRef.current.get(slug);
        if (isDirty(local, snap)) nextDirty.add(slug);
      }
      dirtyRef.current = nextDirty;

      // Refresh the snapshot to the new server truth.
      serverSnapshotRef.current = serverBySlug;

      if (nextDirty.size === 0) return serverPlans;

      const merged = serverPlans.map((sp) =>
        nextDirty.has(sp.slug) && prevBySlug.has(sp.slug)
          ? (prevBySlug.get(sp.slug) as PlanRow)
          : sp
      );
      // Preserve dirty local rows that don't exist on the server yet.
      for (const [slug, p] of prevBySlug) {
        if (nextDirty.has(slug) && !serverBySlug.has(slug)) merged.push(p);
      }
      return merged.sort((a, b) => a.sort_order - b.sort_order);
    });

    setPrices(((pricesRes.data as unknown) as PriceRow[]) ?? []);
    setCountries((countriesRes.data as any) ?? []);
    setLimitsCatalog(((catalogRes.data as unknown) as LimitCatalogRow[]) ?? []);
    setLoading(false);
  };


  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-plans-dynamic")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_country_prices" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const visiblePlans = useMemo(
    () => plans.filter((p) => showArchived ? !!p.archived_at : !p.archived_at),
    [plans, showArchived]
  );

  const savePlan = async (p: PlanRow) => {
    setSaving(p.slug);
    const { error } = await supabase
      .from("plans")
      .update({
        name: p.name,
        description: p.description,
        active: p.active,
        sort_order: p.sort_order,
        color: p.color,
        icon: p.icon,
        label: p.label,
        visible_on_landing: p.visible_on_landing,
        visible_on_billing: p.visible_on_billing,
        visible_on_checkout: p.visible_on_checkout,
        visible_on_compare: p.visible_on_compare,
        limits: p.limits ?? {},
        cta_mode: p.cta_mode,
        cta_label: p.cta_label,
        cta_url: p.cta_url,
        badge_label: p.badge_label,
        show_button: p.show_button,
        show_price: p.show_price,
        show_trial: p.show_trial,
        show_badge: p.show_badge,
      } as any)

      .eq("slug", p.slug);
    setSaving(null);
    if (error) return toast.error("Erro ao guardar: " + error.message);
    // Clear dirty BEFORE the realtime callback fires so the fresh server row wins.
    clearDirty(p.slug);
    toast.success(`Plano ${p.name} atualizado`);
    try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch {}
    // Force a reload so any DB-side transforms (triggers, defaults) reach the UI immediately.
    void load();
  };

  const createPlan = async () => {
    const slug = newPlan.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!slug) return toast.error("Slug obrigatório (apenas letras minúsculas, números, _ ou -)");
    if (!newPlan.name.trim()) return toast.error("Nome obrigatório");
    if (plans.some((p) => p.slug === slug)) return toast.error("Já existe um plano com esse slug");
    const nextOrder = Math.max(0, ...plans.map((p) => p.sort_order)) + 1;
    const { error } = await supabase.from("plans").insert({
      slug,
      name: newPlan.name.trim(),
      description: newPlan.description.trim() || null,
      sort_order: nextOrder,
      active: true,
    } as any);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`Plano "${newPlan.name}" criado. Configura preços por país abaixo.`);
    setCreateOpen(false);
    setNewPlan({ slug: "", name: "", description: "" });
    setExpanded(slug);
  };

  const duplicatePlan = async (p: PlanRow) => {
    const base = `${p.slug}_copy`;
    let candidate = base;
    let n = 2;
    while (plans.some((x) => x.slug === candidate)) { candidate = `${base}${n++}`; }
    const nextOrder = Math.max(0, ...plans.map((x) => x.sort_order)) + 1;
    const { error } = await supabase.from("plans").insert({
      slug: candidate,
      name: `${p.name} (cópia)`,
      description: p.description,
      sort_order: nextOrder,
      active: false,
      color: p.color,
      icon: p.icon,
      label: p.label,
    } as any);
    if (error) return toast.error("Erro: " + error.message);
    // Copy prices too
    const src = prices.filter((pr) => pr.plan_slug === p.slug);
    if (src.length > 0) {
      const clones = src.map((pr) => ({
        plan_slug: candidate,
        country_code: pr.country_code,
        cycle: pr.cycle,
        currency: pr.currency,
        amount: pr.amount,
        // Stripe IDs must NOT be reused between plans — leave blank; admin
        // creates fresh Stripe products/prices via the sync button.
        stripe_product_id: null,
        stripe_price_id: null,
        active: false,
      }));
      await supabase.from("plan_country_prices" as any).insert(clones);
    }
    toast.success(`Plano duplicado como "${candidate}" (inativo — configura Stripe IDs)`);
  };

  const archivePlan = async (p: PlanRow) => {
    const { error } = await supabase.from("plans").update({ archived_at: new Date().toISOString(), active: false } as any).eq("slug", p.slug);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`Plano ${p.name} arquivado`);
  };

  const restorePlan = async (p: PlanRow) => {
    const { error } = await supabase.from("plans").update({ archived_at: null } as any).eq("slug", p.slug);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`Plano ${p.name} restaurado`);
  };

  const deletePlan = async (p: PlanRow) => {
    // Guard: block if any subscription still references this plan.
    const { count } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan", p.slug);
    if ((count ?? 0) > 0) {
      return toast.error(`Não é possível eliminar: ${count} subscrição(ões) ainda usam este plano. Arquiva em vez de eliminar.`);
    }
    if (!confirm(`Eliminar plano "${p.name}" definitivamente? Esta ação é irreversível.`)) return;
    const { error } = await supabase.from("plans").delete().eq("slug", p.slug);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`Plano ${p.name} eliminado`);
  };

  const upsertPrice = async (planSlug: string, countryCode: string, cycle: Cycle, patch: Partial<PriceRow>) => {
    const country = countries.find((c) => c.code === countryCode);
    const currency = patch.currency ?? country?.currency ?? "EUR";
    const existing = prices.find((p) => p.plan_slug === planSlug && p.country_code === countryCode && p.cycle === cycle);
    const merged = {
      plan_slug: planSlug,
      country_code: countryCode,
      cycle,
      currency,
      amount: patch.amount ?? existing?.amount ?? 0,
      stripe_product_id: patch.stripe_product_id ?? existing?.stripe_product_id ?? null,
      stripe_price_id: patch.stripe_price_id ?? existing?.stripe_price_id ?? null,
      active: patch.active ?? existing?.active ?? true,
    };
    const { error } = await supabase
      .from("plan_country_prices" as any)
      .upsert(merged, { onConflict: "plan_slug,country_code,cycle" });
    if (error) return toast.error("Erro ao guardar preço: " + error.message);
    toast.success(`Preço ${planSlug}/${countryCode}/${cycle} guardado`);
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Admin</Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Planos</h1>
              <p className="text-sm text-muted-foreground">Cria, edita, duplica e arquiva planos. Zero código.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1 rounded-md border">
              <Label htmlFor="show-archived" className="text-xs">Ver arquivados</Label>
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            </div>
            <Link to="/admin/countries">
              <Button variant="outline" size="sm"><Globe className="w-4 h-4 mr-2" />Países</Button>
            </Link>
            <Link to="/admin/features">
              <Button variant="outline" size="sm"><ListChecks className="w-4 h-4 mr-2" />Funcionalidades</Button>
            </Link>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo plano</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar novo plano</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Slug (imutável)</Label>
                    <Input placeholder="ex: enterprise" value={newPlan.slug} onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })} />
                    <p className="text-xs text-muted-foreground mt-1">Apenas letras minúsculas, números, _ ou -. Não pode ser alterado depois (usado pelo Stripe).</p>
                  </div>
                  <div>
                    <Label>Nome</Label>
                    <Input placeholder="ex: Enterprise" value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea rows={2} value={newPlan.description} onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={createPlan}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {visiblePlans.map((p) => {
              const planPrices = prices.filter((pr) => pr.plan_slug === p.slug);
              const isOpen = expanded === p.slug;
              return (
                <Card key={p.slug}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">{p.slug}</Badge>
                        <span>{p.name}</span>
                        {p.label && <Badge>{p.label}</Badge>}
                        {p.archived_at && <Badge variant="secondary">Arquivado</Badge>}
                      </CardTitle>
                      <CardDescription>{p.description || "—"}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Ativo</Label>
                        <Switch
                          checked={p.active}
                          disabled={saving === p.slug}
                          onCheckedChange={async (v) => {
                            // Persistência IMEDIATA — o toggle é a fonte de verdade
                            // do estado ativo do plano. Todos os consumidores
                            // (Landing, Billing, Checkout, Upgrade) reagem via
                            // realtime na tabela `plans`. Sem "Guardar" separado.
                            setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, active: v } : x));
                            setSaving(p.slug);
                            const { error } = await supabase.from("plans").update({ active: v } as any).eq("slug", p.slug);
                            setSaving(null);
                            if (error) {
                              toast.error("Erro ao alterar estado: " + error.message);
                              // reverter UI se falhou
                              setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, active: !v } : x));
                              return;
                            }
                            toast.success(`Plano ${p.name} ${v ? "ativado" : "desativado"} em todo o sistema`);
                          }}
                        />
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : p.slug)}>
                        {isOpen ? "Fechar" : "Configurar"}
                      </Button>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <Label className="text-xs">Nome</Label>
                          <Input value={p.name} onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, name: e.target.value } : x))} />
                        </div>
                        <div>
                          <Label className="text-xs">Ordem</Label>
                          <Input type="number" value={p.sort_order} onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, sort_order: Number(e.target.value) } : x))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Descrição</Label>
                        <Textarea rows={2} value={p.description ?? ""} onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, description: e.target.value } : x))} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Cor (hex)</Label>
                          <Input placeholder="#22c55e" value={p.color ?? ""} onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, color: e.target.value } : x))} />
                        </div>
                        <div>
                          <Label className="text-xs">Ícone (lucide)</Label>
                          <Input placeholder="Rocket" value={p.icon ?? ""} onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, icon: e.target.value } : x))} />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Etiqueta (ex: "Mais Popular")</Label>
                          <Input placeholder="opcional" value={p.label ?? ""} onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, label: e.target.value } : x))} />
                        </div>
                      </div>
                      <div className="space-y-3 p-3 rounded-md border bg-muted/20">
                        <div className="text-sm font-semibold">Botão de conversão (CTA)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Tipo de ação</Label>
                            <select
                              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                              value={p.cta_mode}
                              onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, cta_mode: e.target.value as PlanRow["cta_mode"] } : x))}
                            >
                              <option value="trial">Trial (registo + período de teste)</option>
                              <option value="checkout">Checkout Stripe (compra imediata)</option>
                              <option value="demo">Marcar Demonstração</option>
                              <option value="contact">Contactar Comercial</option>
                              <option value="custom_url">URL personalizada</option>
                              <option value="unavailable">Indisponível (botão desativado)</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">Texto do botão</Label>
                            <Input
                              placeholder={`(auto: "Testar Plano ${p.label || p.name}")`}
                              value={p.cta_label ?? ""}
                              onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, cta_label: e.target.value } : x))}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">Deixe vazio para gerar automaticamente a partir do nome do plano.</p>
                          </div>
                          {p.cta_mode === "custom_url" && (
                            <div className="md:col-span-2">
                              <Label className="text-xs">URL de destino</Label>
                              <Input
                                placeholder="/pagina-interna  ou  https://exemplo.com/…"
                                value={p.cta_url ?? ""}
                                onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, cta_url: e.target.value } : x))}
                              />
                            </div>
                          )}
                          <div>
                            <Label className="text-xs">Texto do selo (badge)</Label>
                            <Input
                              placeholder='ex.: "Mais Popular"'
                              value={p.badge_label ?? ""}
                              onChange={(e) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, badge_label: e.target.value } : x))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                          {[
                            { k: "show_button", label: "Mostrar botão" },
                            { k: "show_price", label: "Mostrar preço" },
                            { k: "show_trial", label: "Mostrar trial" },
                            { k: "show_badge", label: "Mostrar selo" },
                          ].map(({ k, label }) => (
                            <div key={k} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                              <Label className="text-xs">{label}</Label>
                              <Switch
                                checked={(p as any)[k] ?? true}
                                onCheckedChange={(v) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, [k]: v } as PlanRow : x))}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Estas definições propagam-se em tempo real para Landing, Billing, Checkout, comparador e SEO.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md border bg-muted/30">
                        {[
                          { k: "visible_on_landing", label: "Landing" },
                          { k: "visible_on_billing", label: "Billing" },
                          { k: "visible_on_checkout", label: "Checkout" },
                          { k: "visible_on_compare", label: "Comparação" },
                        ].map(({ k, label }) => (
                          <div key={k} className="flex items-center justify-between gap-2">
                            <Label className="text-xs">{label}</Label>
                            <Switch
                              checked={(p as any)[k]}
                              onCheckedChange={(v) => setPlans((arr) => arr.map((x) => x.slug === p.slug ? { ...x, [k]: v } as PlanRow : x))}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Limites dinâmicos (100% data-driven) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">Limites do plano</h3>
                          <span className="text-xs text-muted-foreground">
                            {limitsCatalog.length} limite(s) · <span className="font-mono">-1</span> = ilimitado
                          </span>
                        </div>
                        {Object.entries(
                          limitsCatalog.reduce<Record<string, LimitCatalogRow[]>>((acc, l) => {
                            (acc[l.category] ??= []).push(l);
                            return acc;
                          }, {})
                        ).map(([category, items]) => (
                          <div key={category} className="rounded-md border p-3 space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {category}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {items.map((limit) => {
                                const raw = (p.limits ?? {})[limit.key];
                                const isBool = limit.unit === "boolean";
                                const numValue = typeof raw === "number" ? raw : (typeof raw === "boolean" ? (raw ? 1 : 0) : 0);
                                const boolValue = typeof raw === "boolean" ? raw : (typeof raw === "number" ? raw !== 0 : false);
                                const unlimited = !isBool && numValue === -1;
                                const setLimit = (val: number | boolean) =>
                                  setPlans((arr) => arr.map((x) => x.slug === p.slug
                                    ? { ...x, limits: { ...(x.limits ?? {}), [limit.key]: val } }
                                    : x));
                                return (
                                  <div key={limit.key} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <Label className="text-xs" title={limit.description ?? ""}>{limit.label}</Label>
                                      {isBool ? (
                                        <Switch checked={boolValue} onCheckedChange={(v) => setLimit(v)} />
                                      ) : limit.allow_unlimited ? (
                                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <input
                                            type="checkbox"
                                            checked={unlimited}
                                            onChange={(e) => setLimit(e.target.checked ? -1 : 0)}
                                          />
                                          ∞
                                        </label>
                                      ) : null}
                                    </div>
                                    {!isBool && (
                                      <Input
                                        type="number"
                                        step={limit.unit === "percent" ? "0.01" : "1"}
                                        value={unlimited ? "" : numValue}
                                        placeholder={unlimited ? "Ilimitado" : "0"}
                                        disabled={unlimited}
                                        onChange={(e) => setLimit(e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="h-8 text-xs font-mono"
                                      />
                                    )}
                                    {limit.description && (
                                      <p className="text-[10px] text-muted-foreground leading-tight">
                                        {limit.description}
                                        {limit.unit !== "boolean" && limit.unit !== "count" && (
                                          <span className="ml-1 opacity-70">({limit.unit})</span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {limitsCatalog.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Catálogo de limites vazio. Adiciona entradas em <code>plan_limits_catalog</code>.
                          </p>
                        )}
                      </div>


                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">Preços por país e ciclo</h3>
                          <span className="text-xs text-muted-foreground">{planPrices.length} entradas</span>
                        </div>
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2">País</th>
                                <th className="text-left p-2">Ciclo</th>
                                <th className="text-left p-2">Moeda</th>
                                <th className="text-left p-2">Montante</th>
                                <th className="text-left p-2">Stripe Product</th>
                                <th className="text-left p-2">Stripe Price</th>
                                <th className="text-left p-2">Ativo</th>
                                <th className="text-right p-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {countries.flatMap((c) => CYCLES.map((cy) => {
                                const row = planPrices.find((pr) => pr.country_code === c.code && pr.cycle === cy);
                                const key = `${p.slug}-${c.code}-${cy}`;
                                return (
                                  <PriceEditor
                                    key={key}
                                    country={c}
                                    cycle={cy}
                                    row={row}
                                    onSave={async (patch) => { await upsertPrice(p.slug, c.code, cy, patch); }}
                                  />
                                );
                              }))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex justify-between gap-2 flex-wrap pt-2 border-t">
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => duplicatePlan(p)}>
                            <Copy className="w-4 h-4 mr-2" />Duplicar
                          </Button>
                          {p.archived_at ? (
                            <Button size="sm" variant="outline" onClick={() => restorePlan(p)}>
                              <ArchiveRestore className="w-4 h-4 mr-2" />Restaurar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => archivePlan(p)}>
                              <Archive className="w-4 h-4 mr-2" />Arquivar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePlan(p)}>
                            <Trash2 className="w-4 h-4 mr-2" />Eliminar
                          </Button>
                        </div>
                        <Button onClick={() => savePlan(p)} disabled={saving === p.slug}>
                          {saving === p.slug ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Guardar metadados
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
            {visiblePlans.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {showArchived ? "Sem planos arquivados." : "Sem planos ativos. Cria um novo."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceEditor({ country, cycle, row, onSave }: {
  country: CountryRow;
  cycle: Cycle;
  row?: PriceRow;
  onSave: (patch: Partial<PriceRow>) => Promise<void>;
}) {
  const [amount, setAmount] = useState(row?.amount ?? 0);
  const [productId, setProductId] = useState(row?.stripe_product_id ?? "");
  const [priceId, setPriceId] = useState(row?.stripe_price_id ?? "");
  const [active, setActive] = useState(row?.active ?? true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount(row?.amount ?? 0);
    setProductId(row?.stripe_product_id ?? "");
    setPriceId(row?.stripe_price_id ?? "");
    setActive(row?.active ?? true);
  }, [row?.id, row?.amount, row?.stripe_product_id, row?.stripe_price_id, row?.active]);

  const dirty = row
    ? (amount !== row.amount || (productId || "") !== (row.stripe_product_id || "") || (priceId || "") !== (row.stripe_price_id || "") || active !== row.active)
    : (amount > 0 || productId !== "" || priceId !== "");

  const save = async () => {
    setBusy(true);
    await onSave({ amount, stripe_product_id: productId || null, stripe_price_id: priceId || null, active, currency: country.currency });
    setBusy(false);
  };

  return (
    <tr className="border-t">
      <td className="p-2">{country.code} — {country.name}</td>
      <td className="p-2 capitalize">{cycle}</td>
      <td className="p-2">{country.currency}</td>
      <td className="p-2 w-28"><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="h-8 text-xs" /></td>
      <td className="p-2 w-40"><Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="prod_..." className="h-8 text-xs font-mono" /></td>
      <td className="p-2 w-40"><Input value={priceId} onChange={(e) => setPriceId(e.target.value)} placeholder="price_..." className="h-8 text-xs font-mono" /></td>
      <td className="p-2"><Switch checked={active} onCheckedChange={setActive} /></td>
      <td className="p-2 text-right">
        <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || busy} onClick={save}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
        </Button>
      </td>
    </tr>
  );
}
