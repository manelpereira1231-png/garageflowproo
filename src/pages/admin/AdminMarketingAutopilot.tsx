import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Rocket, Sparkles, Loader2, Image as ImageIcon, Target, BarChart3,
  Wand2, RefreshCw, Megaphone, History, ChevronRight, PlayCircle, PauseCircle, Archive,
  Facebook, Instagram, Send, Download, Copy, Calendar, ExternalLink,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Campaign = {
  id: string;
  title: string;
  strategy: string;
  angle: string | null;
  target_audience: any;
  channels: string[];
  keywords: string[];
  geo: string[];
  headlines: string[];
  descriptions: string[];
  ctas: string[];
  ab_variants: any[];
  forecast: any;
  market: string;
  monthly_budget_eur: number | null;
  status: string;
  created_at: string;
};

type Creative = {
  id: string;
  campaign_id: string | null;
  creative_type: string;
  prompt: string;
  image_url: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

type Optimization = {
  id: string;
  campaign_id: string;
  iteration: number;
  reasoning: string | null;
  changes: any;
  simulated_metrics: any;
  created_at: string;
};

const CREATIVE_TYPES = [
  { id: "dashboard_overlay", label: "Dashboard + overlay" },
  { id: "mechanic_tablet", label: "Mecânico com tablet" },
  { id: "modern_shop", label: "Oficina moderna" },
  { id: "growth_chart", label: "Gráfico de crescimento" },
  { id: "before_after", label: "Antes / depois" },
  { id: "team_meeting", label: "Equipa em reunião" },
];

const fmtEUR = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);

export default function AdminMarketingAutopilot() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [loading, setLoading] = useState(true);

  // Generator state
  const [genMarket, setGenMarket] = useState("Portugal");
  const [genBudget, setGenBudget] = useState(500);
  const [genCount, setGenCount] = useState(3);
  const [generating, setGenerating] = useState(false);

  // Creative studio state
  const [creativeType, setCreativeType] = useState("modern_shop");
  const [customPrompt, setCustomPrompt] = useState("");
  const [creativeCampaignId, setCreativeCampaignId] = useState<string>("");
  const [genCreative, setGenCreative] = useState(false);

  // Optimization state
  const [optimizingId, setOptimizingId] = useState<string | null>(null);

  // Selected campaign for detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, cr, op] = await Promise.all([
      supabase.from("marketing_campaigns" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("marketing_creatives" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("marketing_optimizations" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setCampaigns((c.data as any) ?? []);
    setCreatives((cr.data as any) ?? []);
    setOptimizations((op.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-autopilot", {
        body: {
          action: "generate",
          market: genMarket,
          monthlyBudgetEur: Number(genBudget),
          count: Number(genCount),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${(data as any).campaigns?.length ?? 0} campanhas geradas pela IA`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar campanhas");
    } finally {
      setGenerating(false);
    }
  };

  const generateCreative = async () => {
    setGenCreative(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-creative", {
        body: {
          creativeType,
          campaignId: creativeCampaignId || null,
          customPrompt: customPrompt.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Criativo gerado");
      setCustomPrompt("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar criativo");
    } finally {
      setGenCreative(false);
    }
  };

  const optimize = async (campaignId: string) => {
    setOptimizingId(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-autopilot", {
        body: { action: "optimize", campaignId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Otimização #${(data as any).iteration} aplicada`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao otimizar");
    } finally {
      setOptimizingId(null);
    }
  };

  const setStatus = async (campaignId: string, status: string) => {
    const { error } = await supabase
      .from("marketing_campaigns" as any)
      .update({ status })
      .eq("id", campaignId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Estado alterado para ${status}`);
    load();
  };

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const selectedCreatives = creatives.filter((c) => c.campaign_id === selectedId);
  const selectedOpts = optimizations.filter((o) => o.campaign_id === selectedId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Autopiloto de Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Motor de crescimento 100% IA — gera campanhas, criativos, segmentação, previsão e otimização contínua.
            </p>
          </div>
        </div>
        <Button onClick={load} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="active"><Megaphone className="h-3 w-3 mr-1" />Campanhas ativas</TabsTrigger>
          <TabsTrigger value="generated"><Sparkles className="h-3 w-3 mr-1" />Campanhas IA</TabsTrigger>
          <TabsTrigger value="studio"><ImageIcon className="h-3 w-3 mr-1" />Estúdio criativos</TabsTrigger>
          <TabsTrigger value="targeting"><Target className="h-3 w-3 mr-1" />Segmentação</TabsTrigger>
          <TabsTrigger value="forecast"><BarChart3 className="h-3 w-3 mr-1" />Previsão</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3 w-3 mr-1" />Histórico otimização</TabsTrigger>
        </TabsList>

        {/* ===================== CAMPANHAS ATIVAS ===================== */}
        <TabsContent value="active" className="mt-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Campanhas ativas / lançadas</h2>
            {campaigns.filter((c) => c.status === "active").length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha ativa. Gera campanhas IA e marca como "ativa".</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {campaigns.filter((c) => c.status === "active").map((c) => (
                  <CampaignCard key={c.id} campaign={c} onSelect={() => setSelectedId(c.id)}
                    onOptimize={() => optimize(c.id)} onSetStatus={(s) => setStatus(c.id, s)}
                    optimizing={optimizingId === c.id} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ===================== GERADAS POR IA ===================== */}
        <TabsContent value="generated" className="mt-4 space-y-4">
          <Card className="p-5 border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Gerador automático de campanhas</h2>
              <Badge variant="outline" className="ml-1">gemini-3-flash</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              A IA cria 3+ campanhas distintas com estratégia, público-alvo, copy, A/B variants e previsão. Apenas usa funcionalidades reais do GarageFlow.
            </p>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Mercado</Label>
                <Input value={genMarket} onChange={(e) => setGenMarket(e.target.value)} placeholder="Portugal, Brasil, Espanha…" />
              </div>
              <div>
                <Label className="text-xs">Budget mensal (€)</Label>
                <Input type="number" value={genBudget} onChange={(e) => setGenBudget(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nº campanhas (3-6)</Label>
                <Input type="number" min={3} max={6} value={genCount} onChange={(e) => setGenCount(+e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={generate} disabled={generating} className="w-full">
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Gerar campanhas
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {campaigns.length === 0 ? (
              <Card className="p-6 md:col-span-2 text-center text-sm text-muted-foreground">
                Sem campanhas ainda. Usa o gerador acima.
              </Card>
            ) : (
              campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} onSelect={() => setSelectedId(c.id)}
                  onOptimize={() => optimize(c.id)} onSetStatus={(s) => setStatus(c.id, s)}
                  optimizing={optimizingId === c.id} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ===================== ESTÚDIO DE CRIATIVOS ===================== */}
        <TabsContent value="studio" className="mt-4 space-y-4">
          <Card className="p-5 border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Estúdio de criativos IA</h2>
              <Badge variant="outline" className="ml-1">gpt-image-2</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Imagens publicitárias fotorrealistas, estilo B2B SaaS enterprise. Templates fixos para oficinas mecânicas.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs">Tipo de criativo</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={creativeType}
                  onChange={(e) => setCreativeType(e.target.value)}
                >
                  {CREATIVE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Associar a campanha (opcional)</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={creativeCampaignId}
                  onChange={(e) => setCreativeCampaignId(e.target.value)}
                >
                  <option value="">— Nenhuma —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title.slice(0, 60)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={generateCreative} disabled={genCreative} className="w-full">
                  {genCreative ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Gerar criativo
                </Button>
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Prompt personalizado (opcional — substitui o template)</Label>
                <Input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Deixa vazio para usar o template acima"
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {creatives.length === 0 ? (
              <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">
                Sem criativos ainda.
              </Card>
            ) : (
              creatives.map((cr) => (
                <Card key={cr.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted relative">
                    {cr.status === "ready" && cr.image_url ? (
                      <img src={cr.image_url} alt={cr.creative_type} className="w-full h-full object-cover" />
                    ) : cr.status === "failed" ? (
                      <div className="flex items-center justify-center h-full text-xs text-destructive p-2 text-center">
                        Falhou: {cr.error?.slice(0, 100)}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-medium">
                      {CREATIVE_TYPES.find((t) => t.id === cr.creative_type)?.label ?? cr.creative_type}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(cr.created_at).toLocaleString("pt-PT")}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ===================== SEGMENTAÇÃO ===================== */}
        <TabsContent value="targeting" className="mt-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Motor de segmentação IA</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Cada campanha já traz público-alvo, keywords, canais e geo definidos pela IA.
            </p>
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card key={c.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{c.title}</div>
                    <Badge variant="outline">{c.strategy}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Canais:</span>
                      <div className="font-medium">{c.channels.join(" · ") || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Geo:</span>
                      <div className="font-medium">{c.geo.join(", ") || "—"}</div>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Keywords ({c.keywords.length}):</span>
                      <div className="font-medium text-[11px]">{c.keywords.slice(0, 8).join(" · ")}{c.keywords.length > 8 && "…"}</div>
                    </div>
                    {c.target_audience?.painPoints && (
                      <div className="md:col-span-4">
                        <span className="text-muted-foreground">Dores-alvo:</span>
                        <div className="font-medium text-[11px]">{(c.target_audience.painPoints as string[])?.join(" · ")}</div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              {campaigns.length === 0 && (
                <p className="text-sm text-muted-foreground">Gera campanhas para ver segmentação.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ===================== PREVISÃO ===================== */}
        <TabsContent value="forecast" className="mt-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Previsão de performance por campanha</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Campanha</th>
                    <th className="text-right">CTR</th>
                    <th className="text-right">CPC</th>
                    <th className="text-right">CPL</th>
                    <th className="text-right">Conv.</th>
                    <th className="text-right">CAC</th>
                    <th className="text-right">ROI</th>
                    <th className="text-right">Leads/mês</th>
                    <th className="text-right">Pagantes/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const f = c.forecast ?? {};
                    return (
                      <tr key={c.id} className="border-b border-border/30">
                        <td className="py-2 font-medium">{c.title}</td>
                        <td className="text-right">{f.ctrPct != null ? `${f.ctrPct}%` : "—"}</td>
                        <td className="text-right">{f.cpcEur != null ? fmtEUR(f.cpcEur) : "—"}</td>
                        <td className="text-right">{f.cplEur != null ? fmtEUR(f.cplEur) : "—"}</td>
                        <td className="text-right">{f.conversionPct != null ? `${f.conversionPct}%` : "—"}</td>
                        <td className="text-right">{f.cacEur != null ? fmtEUR(f.cacEur) : "—"}</td>
                        <td className="text-right">{f.roiPct != null ? `${f.roiPct}%` : "—"}</td>
                        <td className="text-right">{f.monthlyLeads ?? "—"}</td>
                        <td className="text-right font-semibold">{f.monthlyPayingCustomers ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {campaigns.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Sem previsões.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ===================== HISTÓRICO OTIMIZAÇÃO ===================== */}
        <TabsContent value="history" className="mt-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Loop de otimização — histórico</h2>
            {optimizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem otimizações ainda. Em qualquer campanha, clica em "Otimizar" para a IA rever copy + criativos + targeting.</p>
            ) : (
              <div className="space-y-3">
                {optimizations.map((o) => {
                  const c = campaigns.find((x) => x.id === o.campaign_id);
                  return (
                    <Card key={o.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium">{c?.title ?? "Campanha"} · Iteração #{o.iteration}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-PT")}</div>
                      </div>
                      {o.reasoning && <p className="text-xs text-muted-foreground mb-2">{o.reasoning}</p>}
                      {o.simulated_metrics && (
                        <div className="text-[11px] flex flex-wrap gap-2">
                          {o.simulated_metrics.expectedUpliftPct != null && (
                            <Badge variant="default">+{o.simulated_metrics.expectedUpliftPct}% esperado</Badge>
                          )}
                          {o.simulated_metrics.ctrPct != null && <Badge variant="outline">CTR {o.simulated_metrics.ctrPct}%</Badge>}
                          {o.simulated_metrics.cplEur != null && <Badge variant="outline">CPL {fmtEUR(o.simulated_metrics.cplEur)}</Badge>}
                          {o.simulated_metrics.roiPct != null && <Badge variant="outline">ROI {o.simulated_metrics.roiPct}%</Badge>}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================== DETAIL DRAWER ===================== */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedId(null)}>
          <div
            className="bg-background w-full max-w-2xl h-full overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className="mb-2">{selected.strategy}</Badge>
                <h2 className="text-xl font-bold">{selected.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selected.angle}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>✕</Button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Estado</div>
                <div className="font-semibold">{selected.status}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Mercado / Budget</div>
                <div className="font-semibold">{selected.market} · {fmtEUR(selected.monthly_budget_eur)}/mês</div>
              </Card>
            </div>

            <Card className="p-3">
              <div className="text-xs font-semibold mb-2">Headlines</div>
              <ul className="text-xs space-y-1">
                {selected.headlines.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </Card>

            <Card className="p-3">
              <div className="text-xs font-semibold mb-2">Descrições</div>
              <ul className="text-xs space-y-1">
                {selected.descriptions.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            </Card>

            <Card className="p-3">
              <div className="text-xs font-semibold mb-2">CTAs</div>
              <div className="flex flex-wrap gap-1">
                {selected.ctas.map((c, i) => <Badge key={i} variant="secondary">{c}</Badge>)}
              </div>
            </Card>

            {selected.ab_variants?.length > 0 && (
              <Card className="p-3">
                <div className="text-xs font-semibold mb-2">Variantes A/B</div>
                <div className="space-y-2">
                  {selected.ab_variants.map((v: any, i: number) => (
                    <div key={i} className="text-xs border-l-2 border-primary pl-2">
                      <div className="font-medium">{v.name ?? `Variante ${i + 1}`}</div>
                      <div>{v.headline} — {v.description}</div>
                      <Badge variant="outline" className="mt-1">{v.cta}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {selectedCreatives.length > 0 && (
              <Card className="p-3">
                <div className="text-xs font-semibold mb-2">Criativos associados</div>
                <div className="grid grid-cols-3 gap-2">
                  {selectedCreatives.map((cr) => (
                    cr.image_url && <img key={cr.id} src={cr.image_url} className="rounded aspect-square object-cover" />
                  ))}
                </div>
              </Card>
            )}

            {selectedOpts.length > 0 && (
              <Card className="p-3">
                <div className="text-xs font-semibold mb-2">Otimizações ({selectedOpts.length})</div>
                <div className="space-y-1 text-xs">
                  {selectedOpts.map((o) => (
                    <div key={o.id}>#{o.iteration} — {o.reasoning?.slice(0, 100)}</div>
                  ))}
                </div>
              </Card>
            )}

            <div className="flex gap-2 flex-wrap sticky bottom-0 bg-background pt-3 border-t">
              <Button onClick={() => optimize(selected.id)} disabled={optimizingId === selected.id}>
                {optimizingId === selected.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Otimizar IA
              </Button>
              {selected.status !== "active" && (
                <Button variant="default" onClick={() => setStatus(selected.id, "active")}>
                  <PlayCircle className="h-4 w-4 mr-2" />Ativar
                </Button>
              )}
              {selected.status === "active" && (
                <Button variant="outline" onClick={() => setStatus(selected.id, "paused")}>
                  <PauseCircle className="h-4 w-4 mr-2" />Pausar
                </Button>
              )}
              <Button variant="ghost" onClick={() => setStatus(selected.id, "archived")}>
                <Archive className="h-4 w-4 mr-2" />Arquivar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign, onSelect, onOptimize, onSetStatus, optimizing,
}: {
  campaign: Campaign;
  onSelect: () => void;
  onOptimize: () => void;
  onSetStatus: (s: string) => void;
  optimizing: boolean;
}) {
  const f = campaign.forecast ?? {};
  return (
    <Card className="p-4 hover:border-primary/50 transition cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <Badge variant="outline" className="text-[10px]">{campaign.strategy}</Badge>
          <div className="font-semibold mt-1">{campaign.title}</div>
        </div>
        <Badge variant={
          campaign.status === "active" ? "default" :
          campaign.status === "paused" ? "secondary" :
          campaign.status === "archived" ? "outline" : "secondary"
        }>{campaign.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{campaign.angle}</p>

      <div className="grid grid-cols-4 gap-2 text-[11px] mb-2">
        <Stat label="CTR" value={f.ctrPct != null ? `${f.ctrPct}%` : "—"} />
        <Stat label="CPL" value={f.cplEur != null ? fmtEUR(f.cplEur) : "—"} />
        <Stat label="CAC" value={f.cacEur != null ? fmtEUR(f.cacEur) : "—"} />
        <Stat label="ROI" value={f.roiPct != null ? `${f.roiPct}%` : "—"} />
      </div>

      <div className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" onClick={onOptimize} disabled={optimizing}>
          {optimizing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
          Otimizar
        </Button>
        {campaign.status !== "active" ? (
          <Button size="sm" variant="default" onClick={() => onSetStatus("active")}>
            <PlayCircle className="h-3 w-3 mr-1" />Ativar
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onSetStatus("paused")}>
            <PauseCircle className="h-3 w-3 mr-1" />Pausar
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onSelect}>
          Ver <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-1.5">
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
