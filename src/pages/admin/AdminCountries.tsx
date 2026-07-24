import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, Save, Plus, Edit, Power, Loader2, Zap, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reloadCountriesFromDB } from "@/lib/regionConfig";
import { clearPricingCache } from "@/hooks/useCountryPricing";
import { clearPromotionsCache, ensurePromotionsLoaded } from "@/lib/planPromotions";
import { usePlansCatalog, priceFor } from "@/hooks/usePlansCatalog";

/**
 * Resumo dinâmico dos preços de todos os planos ativos para um país.
 * Iterar a tabela `plans` × `plan_country_prices` — sem hardcodes.
 * Fallback: legacy colunas `saas_pro_monthly` / `saas_garage_monthly` em
 * `country_settings` para dados antigos ainda não migrados.
 */
function CountryPlanSummary({ country }: { country: any }) {
  const { data: catalog } = usePlansCatalog();
  const plans = (catalog?.plans ?? []).filter((p) => p.active && !p.archived_at);
  if (plans.length === 0) return null;
  const rows = plans.map((p) => {
    const modern = priceFor(catalog, p.slug, country.code, "monthly");
    let amount = modern?.amount ?? 0;
    if (!amount) {
      // legacy fallback
      const legacyKey = `saas_${p.slug}_monthly`;
      const legacyVal = country?.[legacyKey];
      if (typeof legacyVal === "number") amount = legacyVal;
    }
    return { slug: p.slug, label: p.label ?? p.name ?? p.slug, amount };
  });
  return (
    <div className="text-xs space-y-1 border-t pt-3">
      {rows.map((r) => (
        <div key={r.slug} className="flex justify-between">
          <span className="text-muted-foreground truncate">{r.label} mensal</span>
          <span className="font-medium">{country.currency_symbol}{r.amount || 0}</span>
        </div>
      ))}
    </div>
  );
}

type PlanSlug = "free" | "pro" | "garage";
type CycleSlug = "monthly" | "yearly";

interface PromoState {
  promo_price: number;
  active: boolean;
  starts_at: string; // datetime-local value
  ends_at: string;
  stripe_price_id: string | null;
  loaded: boolean;
}

interface PlanPromoBlockProps {
  countryCode: string;
  plan: PlanSlug;
  cycle: CycleSlug;
  baseAmount: number;
  currencySymbol: string;
}

/** Converts an ISO date (or null) into the value expected by <input type="datetime-local"> */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function PlanPromoBlock({ countryCode, plan, cycle, baseAmount, currencySymbol }: PlanPromoBlockProps) {
  const [state, setState] = useState<PromoState>({
    promo_price: 0, active: true, starts_at: "", ends_at: "", stripe_price_id: null, loaded: false,
  });
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [existed, setExisted] = useState(false);

  const load = async () => {
    if (!countryCode) return;
    const { data } = await supabase.rpc("admin_get_promotion" as any, {
      p_country_code: countryCode,
      p_plan: plan,
      p_cycle: cycle,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setState({
        promo_price: Number(row.promo_price || 0),
        active: !!row.active,
        starts_at: toLocalInput(row.starts_at as any),
        ends_at: toLocalInput(row.ends_at as any),
        stripe_price_id: row.stripe_price_id ?? null,
        loaded: true,
      });
      setExisted(true);
      setExpanded(true);
    } else {
      setState((s) => ({ ...s, loaded: true }));
      setExisted(false);
    }
  };


  useEffect(() => { void load(); }, [countryCode, plan, cycle]);

  const discountPct = baseAmount > 0 && state.promo_price > 0 && state.promo_price < baseAmount
    ? Math.round(((baseAmount - state.promo_price) / baseAmount) * 100)
    : 0;

  const isLive = (() => {
    if (!existed || !state.active) return false;
    const now = new Date();
    if (state.starts_at && new Date(state.starts_at) > now) return false;
    if (state.ends_at && new Date(state.ends_at) <= now) return false;
    return true;
  })();

  const save = async (action: "upsert" | "deactivate" | "delete") => {
    if (!countryCode) return toast.error("Guarda primeiro o país");
    if (action === "upsert") {
      if (!(state.promo_price > 0)) return toast.error("Preço promocional inválido");
      if (baseAmount > 0 && state.promo_price >= baseAmount) return toast.error("Promo deve ser menor que o preço normal");
      if (state.starts_at && state.ends_at && new Date(state.starts_at) >= new Date(state.ends_at)) {
        return toast.error("Data de início deve ser anterior à data de fim");
      }
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-promotion", {
        body: {
          country_code: countryCode,
          plan,
          cycle,
          promo_price: state.promo_price,
          active: state.active,
          starts_at: toIso(state.starts_at),
          ends_at: toIso(state.ends_at),
          action,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (action === "delete") {
        toast.success("Promoção removida");
        setExisted(false);
        setExpanded(false);
        setState({ promo_price: 0, active: true, starts_at: "", ends_at: "", stripe_price_id: null, loaded: true });
      } else if (action === "deactivate") {
        toast.success("Promoção desativada");
        setState((s) => ({ ...s, active: false }));
      } else {
        toast.success(`Promoção aplicada (−${discountPct}%)`);
        setExisted(true);
        await load();
      }
      clearPromotionsCache();
      await ensurePromotionsLoaded();
      try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(`Erro na promoção: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
      >
        <Tag className="w-3 h-3" /> {existed ? "Editar promoção" : "Adicionar promoção"}
        {isLive && <Badge variant="secondary" className="ml-2 bg-success/15 text-success text-[10px]">ATIVA −{discountPct}%</Badge>}
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-md border border-dashed bg-background/50 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <Tag className="w-3 h-3 text-primary" /> Promoção
          {isLive && <Badge variant="secondary" className="bg-success/15 text-success text-[10px]">ATIVA</Badge>}
          {existed && !isLive && <Badge variant="outline" className="text-[10px]">agendada / expirada / inativa</Badge>}
        </Label>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Ativa</Label>
          <Switch checked={state.active} onCheckedChange={(v) => setState((s) => ({ ...s, active: v }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Preço promocional ({currencySymbol})</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={state.promo_price}
            onChange={(e) => setState((s) => ({ ...s, promo_price: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label className="text-[10px]">Desconto calculado</Label>
          <div className="h-10 px-3 rounded-md border border-input bg-muted/40 flex items-center text-sm font-semibold">
            {discountPct > 0 ? `−${discountPct}%` : "—"}
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Início (opcional)</Label>
          <Input type="datetime-local" value={state.starts_at} onChange={(e) => setState((s) => ({ ...s, starts_at: e.target.value }))} />
        </div>
        <div>
          <Label className="text-[10px]">Fim (opcional)</Label>
          <Input type="datetime-local" value={state.ends_at} onChange={(e) => setState((s) => ({ ...s, ends_at: e.target.value }))} />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={() => save("upsert")} disabled={busy} className="h-8">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
          Aplicar promoção
        </Button>
        {existed && state.active && (
          <Button type="button" size="sm" variant="outline" onClick={() => save("deactivate")} disabled={busy} className="h-8">
            Desativar
          </Button>
        )}
        {existed && (
          <Button type="button" size="sm" variant="ghost" onClick={() => save("delete")} disabled={busy} className="h-8 text-destructive">
            <Trash2 className="w-3 h-3 mr-1" /> Remover
          </Button>
        )}
        {state.stripe_price_id && (
          <span className="text-[10px] text-muted-foreground font-mono ml-auto truncate max-w-[150px]" title={state.stripe_price_id}>
            {state.stripe_price_id}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Quando a data de fim passa, a plataforma volta automaticamente ao preço normal — sem intervenção.
      </p>
    </div>
  );
}


interface PlanPriceRowProps {
  label: string;
  plan: "free" | "pro" | "garage";
  cycle: "monthly" | "yearly";
  countryCode: string;
  amount: number;
  currentPriceId: string | null;
  onAmountChange: (value: number) => void;
  onApplied: (result: { amount: number; new_stripe_price_id: string | null; old_stripe_price_id: string | null }) => void;
}

function PlanPriceRow({ label, plan, cycle, countryCode, amount, currentPriceId, onAmountChange, onApplied }: PlanPriceRowProps) {
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    if (!countryCode) return toast.error("Guarda primeiro o país antes de aplicar no Stripe");
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Valor inválido");
    if (amount === 0 && plan !== "free") return toast.error("Só o plano de Entrada pode ter valor 0");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-plan-price", {
        body: { country_code: countryCode, plan, cycle, amount },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const isFree = plan === "free" && amount === 0;
      if (isFree) {
        toast.success(`${label}: definido como gratuito. Stripe Price antigo desativado e referências limpas.`);
      } else {
        toast.success(`${label}: Stripe Price criado e propagado (${(data as any)?.new_stripe_price_id ?? "—"})`);
      }
      onApplied(data as any);
      // Broadcast for any open landing/billing tab to refresh immediately
      try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch { /* ignore */ }
    } catch (e: any) {
      const msg = e?.message || e?.error?.message || String(e);
      toast.error(`Falha ao aplicar no Stripe (${label}): ${msg}`);
      console.error("[admin-update-plan-price] error:", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex-1 min-w-0">
        <Label className="text-xs">{label}</Label>
        <Input type="number" step="0.01" value={amount} onChange={(e) => onAmountChange(Number(e.target.value))} />
        <p className="text-[10px] text-muted-foreground mt-1 truncate font-mono">
          {currentPriceId || "sem Stripe Price ainda"}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={apply} disabled={busy} className="shrink-0">
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
        Aplicar no Stripe
      </Button>
    </div>
  );
}

interface CountryRow {
  code: string;
  name: string;
  flag_emoji: string;
  currency: string;
  currency_symbol: string;
  locale: string;
  default_language: string;
  tax_label: string;
  saas_pro_monthly: number;
  saas_pro_yearly: number;
  saas_garage_monthly: number;
  saas_garage_yearly: number;
  saas_trial_days: number;
  inspection_price: number;
  inspection_shop_share: number;
  inspection_platform_share: number;
  market_commission_rate: number;
  stripe_pro_monthly: string | null;
  stripe_pro_yearly: string | null;
  stripe_garage_monthly: string | null;
  stripe_garage_yearly: string | null;
  active: boolean;
  notes: string | null;
}

const BLANK_COUNTRY: Partial<CountryRow> = {
  code: "",
  name: "",
  flag_emoji: "🌍",
  currency: "USD",
  currency_symbol: "$",
  locale: "en-US",
  default_language: "en",
  tax_label: "Tax",
  saas_pro_monthly: 49,
  saas_pro_yearly: 490,
  saas_garage_monthly: 99,
  saas_garage_yearly: 990,
  saas_trial_days: 30,
  inspection_price: 29.9,
  inspection_shop_share: 17,
  inspection_platform_share: 12.9,
  market_commission_rate: 0.02,
  active: false,
};

export default function AdminCountries() {
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CountryRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"all" | "active" | "inactive">("all");

  const load = async () => {
    setLoading(true);
    // Use SECURITY DEFINER RPC: returns full rows (including Stripe IDs) for super admins only.
    // Direct SELECT * is column-restricted by security GRANTs.
    const { data, error } = await (supabase as any).rpc("admin_list_country_settings");
    if (error) {
      toast.error("Erro a carregar países: " + error.message);
      setCountries([]);
    } else {
      setCountries((data as CountryRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = countries.filter(c =>
    tab === "all" ? true : tab === "active" ? c.active : !c.active
  );

  const toggleActive = async (c: CountryRow) => {
    const { error } = await supabase.from("country_settings")
      .update({ active: !c.active }).eq("code", c.code);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`${c.name} ${!c.active ? "ativado" : "desativado"}`);
    clearPricingCache();
    await reloadCountriesFromDB();
    load();
  };

  const save = async () => {
    if (!editing?.code || !editing?.name || !editing?.currency) {
      return toast.error("Código, Nome e Moeda são obrigatórios");
    }
    setSaving(true);
    const isNew = !countries.find(c => c.code === editing.code);
    const payload = { ...editing, code: editing.code!.toUpperCase() };
    const { error } = isNew
      ? await supabase.from("country_settings").insert(payload as any)
      : await supabase.from("country_settings").update(payload as any).eq("code", editing.code);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`País ${isNew ? "criado" : "atualizado"} — preços propagados em tempo real`);
    setEditing(null);
    clearPricingCache();
    await reloadCountriesFromDB();
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Países & Mercados Globais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura preços, moedas e comissões para cada país onde o GarageFlow opera.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...BLANK_COUNTRY })}>
          <Plus className="w-4 h-4 mr-2" /> Novo País
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Países ativos</p>
          <p className="text-2xl font-bold">{countries.filter(c => c.active).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Países preparados</p>
          <p className="text-2xl font-bold">{countries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Moedas suportadas</p>
          <p className="text-2xl font-bold">{new Set(countries.filter(c => c.active).map(c => c.currency)).size}</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos ({countries.length})</TabsTrigger>
          <TabsTrigger value="active">Ativos ({countries.filter(c => c.active).length})</TabsTrigger>
          <TabsTrigger value="inactive">Inativos ({countries.filter(c => !c.active).length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(c => (
                <Card key={c.code} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{c.flag_emoji}</span>
                        <div>
                          <h3 className="font-semibold">{c.name}</h3>
                          <p className="text-xs text-muted-foreground">{c.code} · {c.currency}</p>
                        </div>
                      </div>
                    </div>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <CountryPlanSummary country={c} />
                  <div className="text-xs space-y-1 border-t pt-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Inspeção</span><span className="font-medium">{c.currency_symbol}{c.inspection_price}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">→ Oficina</span><span className="font-medium text-emerald-600">{c.currency_symbol}{c.inspection_shop_share}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">→ Plataforma</span><span className="font-medium">{c.currency_symbol}{c.inspection_platform_share}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Comissão Market</span><span className="font-medium">{(c.market_commission_rate * 100).toFixed(1)}%</span></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({ ...c })}>
                      <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant={c.active ? "secondary" : "default"} onClick={() => toggleActive(c)}>
                      <Power className="w-3.5 h-3.5 mr-1" /> {c.active ? "Pausar" : "Ativar"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.code && countries.find(c => c.code === editing.code) ? "Editar País" : "Novo País"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código (2-3 letras) *</Label>
                  <Input value={editing.code || ""} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="PT" maxLength={3} disabled={!!countries.find(c => c.code === editing.code)} />
                </div>
                <div>
                  <Label>Bandeira</Label>
                  <Input value={editing.flag_emoji || ""} onChange={e => setEditing({ ...editing, flag_emoji: e.target.value })} placeholder="🇵🇹" />
                </div>
                <div className="col-span-2">
                  <Label>Nome *</Label>
                  <Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Moeda (ISO) *</Label>
                  <Input value={editing.currency || ""} onChange={e => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} placeholder="EUR" maxLength={3} />
                </div>
                <div>
                  <Label>Símbolo</Label>
                  <Input value={editing.currency_symbol || ""} onChange={e => setEditing({ ...editing, currency_symbol: e.target.value })} placeholder="€" />
                </div>
                <div>
                  <Label>Locale</Label>
                  <Input value={editing.locale || ""} onChange={e => setEditing({ ...editing, locale: e.target.value })} placeholder="pt-PT" />
                </div>
                <div>
                  <Label>Idioma padrão</Label>
                  <Input value={editing.default_language || ""} onChange={e => setEditing({ ...editing, default_language: e.target.value })} placeholder="pt" />
                </div>
                <div>
                  <Label>Etiqueta de imposto</Label>
                  <Input value={editing.tax_label || ""} onChange={e => setEditing({ ...editing, tax_label: e.target.value })} placeholder="IVA / GST / VAT" />
                </div>
                <div>
                  <Label>Trial (dias)</Label>
                  <Input type="number" value={editing.saas_trial_days || 0} onChange={e => setEditing({ ...editing, saas_trial_days: Number(e.target.value) })} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-2">Preços SaaS</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Edita o valor e clica em <strong>Aplicar no Stripe</strong> para criar
                  automaticamente o novo Stripe Price e propagar para landing, checkout
                  e afiliados. Clientes atuais mantêm o preço antigo (o Stripe Price
                  antigo é apenas desativado, nunca eliminado).
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {([
                    { key: "saas_free_monthly",   plan: "free" as const,   cycle: "monthly" as const, label: "Entrada mensal", priceCol: "stripe_free_monthly" },
                    { key: "saas_free_yearly",    plan: "free" as const,   cycle: "yearly" as const,  label: "Entrada anual",  priceCol: "stripe_free_yearly" },
                    { key: "saas_pro_monthly",    plan: "pro" as const,    cycle: "monthly" as const, label: "Pro mensal",     priceCol: "stripe_pro_monthly" },
                    { key: "saas_pro_yearly",     plan: "pro" as const,    cycle: "yearly" as const,  label: "Pro anual",      priceCol: "stripe_pro_yearly" },
                    { key: "saas_garage_monthly", plan: "garage" as const, cycle: "monthly" as const, label: "Garage mensal",  priceCol: "stripe_garage_monthly" },
                    { key: "saas_garage_yearly",  plan: "garage" as const, cycle: "yearly" as const,  label: "Garage anual",   priceCol: "stripe_garage_yearly" },
                  ]).map((row) => (
                    <div key={row.key} className="space-y-1">
                      <PlanPriceRow
                        label={row.label}
                        plan={row.plan}
                        cycle={row.cycle}
                        countryCode={editing.code || ""}
                        amount={Number((editing as any)[row.key] || 0)}
                        currentPriceId={(editing as any)[row.priceCol] || null}
                        onAmountChange={(v) => setEditing({ ...editing, [row.key]: v } as any)}
                        onApplied={async (res) => {
                          setEditing({
                            ...editing,
                            [row.key]: res.amount,
                            [row.priceCol]: res.new_stripe_price_id,
                          } as any);
                          clearPricingCache();
                          await reloadCountriesFromDB();
                          load();
                        }}
                      />
                      <PlanPromoBlock
                        countryCode={editing.code || ""}
                        plan={row.plan}
                        cycle={row.cycle}
                        baseAmount={Number((editing as any)[row.key] || 0)}
                        currencySymbol={editing.currency_symbol || ""}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-2">Inspeção Market</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Preço total</Label>
                    <Input type="number" step="0.01" value={editing.inspection_price || 0} onChange={e => setEditing({ ...editing, inspection_price: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>→ Oficina</Label>
                    <Input type="number" step="0.01" value={editing.inspection_shop_share || 0} onChange={e => setEditing({ ...editing, inspection_shop_share: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>→ Plataforma</Label>
                    <Input type="number" step="0.01" value={editing.inspection_platform_share || 0} onChange={e => setEditing({ ...editing, inspection_platform_share: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label>Comissão Market (decimal — 0.02 = 2%)</Label>
                  <Input type="number" step="0.001" value={editing.market_commission_rate || 0} onChange={e => setEditing({ ...editing, market_commission_rate: Number(e.target.value) })} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-2">Stripe Price IDs (read-only)</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Estes IDs são geridos automaticamente pelo botão "Aplicar no Stripe".
                  Mostrados apenas para auditoria.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="truncate">Entrada mensal: {(editing as any).stripe_free_monthly || "—"}</div>
                  <div className="truncate">Entrada anual: {(editing as any).stripe_free_yearly || "—"}</div>
                  <div className="truncate">Pro mensal: {editing.stripe_pro_monthly || "—"}</div>
                  <div className="truncate">Pro anual: {editing.stripe_pro_yearly || "—"}</div>
                  <div className="truncate">Garage mensal: {editing.stripe_garage_monthly || "—"}</div>
                  <div className="truncate">Garage anual: {editing.stripe_garage_yearly || "—"}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t pt-4">
                <Switch checked={editing.active || false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>País ativo (visível para utilizadores)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
