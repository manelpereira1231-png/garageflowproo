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
import { Globe, Save, Plus, Edit, Power, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { reloadCountriesFromDB } from "@/lib/regionConfig";
import { clearPricingCache } from "@/hooks/useCountryPricing";

interface PlanPriceRowProps {
  label: string;
  plan: "pro" | "garage";
  cycle: "monthly" | "yearly";
  countryCode: string;
  amount: number;
  currentPriceId: string | null;
  onAmountChange: (value: number) => void;
  onApplied: (result: { amount: number; new_stripe_price_id: string; old_stripe_price_id: string | null }) => void;
}

function PlanPriceRow({ label, plan, cycle, countryCode, amount, currentPriceId, onAmountChange, onApplied }: PlanPriceRowProps) {
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    if (!countryCode) return toast.error("Guarda primeiro o país antes de aplicar no Stripe");
    if (!amount || amount <= 0) return toast.error("Valor inválido");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-plan-price", {
        body: { country_code: countryCode, plan, cycle, amount },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${label}: Stripe Price criado e propagado`);
      onApplied(data as any);
      // Broadcast for any open landing/billing tab to refresh immediately
      try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch { /* ignore */ }
    } catch (e: any) {
      toast.error("Falha ao aplicar no Stripe: " + (e?.message || String(e)));
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
    const { data } = await supabase.from("country_settings").select("*").order("active", { ascending: false }).order("name");
    setCountries((data as CountryRow[]) || []);
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
                  <div className="text-xs space-y-1 border-t pt-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Pro mensal</span><span className="font-medium">{c.currency_symbol}{c.saas_pro_monthly}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Garage mensal</span><span className="font-medium">{c.currency_symbol}{c.saas_garage_monthly}</span></div>
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
                    { key: "saas_pro_monthly",     plan: "pro" as const,    cycle: "monthly" as const, label: "Pro mensal",     priceCol: "stripe_pro_monthly" },
                    { key: "saas_pro_yearly",      plan: "pro" as const,    cycle: "yearly" as const,  label: "Pro anual",      priceCol: "stripe_pro_yearly" },
                    { key: "saas_garage_monthly", plan: "garage" as const, cycle: "monthly" as const, label: "Garage mensal", priceCol: "stripe_garage_monthly" },
                    { key: "saas_garage_yearly",   plan: "garage" as const, cycle: "yearly" as const,  label: "Garage anual",   priceCol: "stripe_garage_yearly" },
                  ]).map((row) => (
                    <PlanPriceRow
                      key={row.key}
                      label={row.label}
                      plan={row.plan}
                      cycle={row.cycle}
                      countryCode={editing.code || ""}
                      amount={Number((editing as any)[row.key] || 0)}
                      currentPriceId={(editing as any)[row.priceCol] || null}
                      onAmountChange={(v) => setEditing({ ...editing, [row.key]: v } as any)}
                      onApplied={async (res) => {
                        // Reflect new Stripe Price ID locally without losing form state.
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
