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
import { Globe, Save, Plus, Edit, Power, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reloadCountriesFromDB } from "@/lib/regionConfig";
import { clearPricingCache } from "@/hooks/useCountryPricing";

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
    toast.success(`País ${isNew ? "criado" : "atualizado"}`);
    setEditing(null);
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pro mensal</Label>
                    <Input type="number" step="0.01" value={editing.saas_pro_monthly || 0} onChange={e => setEditing({ ...editing, saas_pro_monthly: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Pro anual</Label>
                    <Input type="number" step="0.01" value={editing.saas_pro_yearly || 0} onChange={e => setEditing({ ...editing, saas_pro_yearly: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Garage mensal</Label>
                    <Input type="number" step="0.01" value={editing.saas_garage_monthly || 0} onChange={e => setEditing({ ...editing, saas_garage_monthly: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Garage anual</Label>
                    <Input type="number" step="0.01" value={editing.saas_garage_yearly || 0} onChange={e => setEditing({ ...editing, saas_garage_yearly: Number(e.target.value) })} />
                  </div>
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
                <h4 className="font-semibold text-sm mb-2">IDs Stripe (opcional)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Pro mensal</Label>
                    <Input value={editing.stripe_pro_monthly || ""} onChange={e => setEditing({ ...editing, stripe_pro_monthly: e.target.value || null })} placeholder="price_..." />
                  </div>
                  <div>
                    <Label className="text-xs">Pro anual</Label>
                    <Input value={editing.stripe_pro_yearly || ""} onChange={e => setEditing({ ...editing, stripe_pro_yearly: e.target.value || null })} placeholder="price_..." />
                  </div>
                  <div>
                    <Label className="text-xs">Garage mensal</Label>
                    <Input value={editing.stripe_garage_monthly || ""} onChange={e => setEditing({ ...editing, stripe_garage_monthly: e.target.value || null })} placeholder="price_..." />
                  </div>
                  <div>
                    <Label className="text-xs">Garage anual</Label>
                    <Input value={editing.stripe_garage_yearly || ""} onChange={e => setEditing({ ...editing, stripe_garage_yearly: e.target.value || null })} placeholder="price_..." />
                  </div>
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
