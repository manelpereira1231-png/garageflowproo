import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Rocket, Sparkles, Loader2, Facebook, Download, RefreshCw,
  Send, ChevronDown, Trash2, Wand2, Image as ImageIcon, Calendar, Copy,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";

type Campaign = {
  id: string;
  title: string;
  strategy: string;
  angle: string | null;
  channels: string[];
  keywords: string[];
  geo: string[];
  headlines: string[];
  descriptions: string[];
  ctas: string[];
  target_audience: any;
  forecast: any;
  market: string;
  monthly_budget_eur: number | null;
  image_url?: string | null;
  status: string;
  created_at: string;
};

const fmtEUR = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

// Invoca a edge function e extrai a mensagem de erro REAL (o supabase-js
// devolve apenas "non-2xx status code" e esconde o corpo da resposta).
async function invokeAutopilot(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("marketing-autopilot", { body });
  if (error) {
    let detail = "";
    try {
      const res = (error as any)?.context;
      if (res && typeof res.json === "function") {
        const payload = await res.clone().json();
        detail = payload?.error ?? "";
      }
    } catch {
      /* corpo não-JSON — mantém mensagem genérica */
    }
    throw new Error(detail || error.message || "A IA falhou. Tenta de novo.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}


export default function AdminMarketingAutopilot() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário único
  const [market, setMarket] = useState("Portugal");
  const [budget, setBudget] = useState(200);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("marketing_campaigns" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setCampaigns((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createCampaign = async () => {
    setBusy(true);
    try {
      const data = await invokeAutopilot({ action: "generate", market, monthlyBudgetEur: Number(budget), count: 3 });
      toast.success(`${(data as any).campaigns?.length ?? 0} campanhas prontas a publicar`);

      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    await supabase.from("marketing_campaigns" as any).delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <Rocket className="h-7 w-7 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Marketing para o GarageFlow</h1>
          <p className="text-sm text-muted-foreground">
            A IA escreve campanhas para captar oficinas. Tu só publicas.
          </p>
        </div>
        <Button onClick={load} variant="ghost" size="icon" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* PASSO 1 — CRIAR */}
      <Card className="p-6 border-primary/40 bg-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-primary text-primary-foreground">Passo 1</Badge>
          <h2 className="font-semibold">Criar campanhas com IA</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Diz onde queres anunciar e quanto vais gastar. A IA gera 3 campanhas prontas a publicar (texto, palavras-chave, segmentação e previsão).
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <Label className="text-xs">Mercado</Label>
            <Input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="Portugal, Brasil, Espanha…" />
          </div>
          <div>
            <Label className="text-xs">Quanto gastas por mês em ads (€)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(+e.target.value)} />
          </div>
          <Button size="lg" onClick={createCampaign} disabled={busy} className="min-w-[200px]">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Criar campanhas
          </Button>
        </div>
      </Card>

      {/* PASSO 2 — PUBLICAR */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline">Passo 2</Badge>
          <h2 className="font-semibold">Publicar nas redes</h2>
          <span className="text-xs text-muted-foreground">
            Carrega em <strong>Publicar</strong> — abre logo o Facebook/Google com tudo preenchido.
          </span>
        </div>

        {campaigns.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Ainda sem campanhas. Cria a primeira no passo 1 ↑
          </Card>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <CampaignRow key={c.id} campaign={c} onRemove={() => remove(c.id)} />
            ))}
          </div>
        )}
      </div>

      {/* BIBLIOTECA DE IMAGENS IA */}
      <CreativesLibrary campaigns={campaigns} />

      {/* AVANÇADO (colapsado) */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ChevronDown className="h-4 w-4 mr-1" /> Opções avançadas
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <AdvancedTools campaigns={campaigns} onChanged={load} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============ LINHA DE CAMPANHA ============
function CampaignRow({ campaign, onRemove }: { campaign: Campaign; onRemove: () => void }) {
  const f = campaign.forecast ?? {};
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px]">{campaign.strategy}</Badge>
            <Badge variant="secondary" className="text-[10px]">{campaign.market}</Badge>
            <span className="text-[11px] text-muted-foreground">{fmtEUR(campaign.monthly_budget_eur)}/mês</span>
          </div>
          <div className="font-semibold">{campaign.title}</div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{campaign.angle}</p>
          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
            <span>Leads ~ <strong className="text-foreground">{f.monthlyLeads ?? "—"}/mês</strong></span>
            <span>Pagantes ~ <strong className="text-foreground">{f.monthlyPayingCustomers ?? "—"}/mês</strong></span>
            <span>CAC ~ <strong className="text-foreground">{fmtEUR(f.cacEur)}</strong></span>
          </div>
        </div>
        <div className="flex gap-2">
          <PublishDialog campaign={campaign} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-label="Ver detalhes">
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remover">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t space-y-3 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">Títulos do anúncio</div>
            <div className="flex flex-wrap gap-1">
              {campaign.headlines.map((h, i) => <Badge key={i} variant="outline">{h}</Badge>)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Descrições</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {campaign.descriptions.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Palavras-chave</div>
            <div className="flex flex-wrap gap-1">
              {campaign.keywords.map((k, i) => <Badge key={i} variant="secondary" className="text-[10px]">{k}</Badge>)}
            </div>
          </div>
          {campaign.geo?.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1">Onde mostrar</div>
              <div className="text-foreground">{campaign.geo.join(" · ")}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ============ DIALOG DE PUBLICAR ============
function PublishDialog({ campaign }: { campaign: Campaign }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [needsSecrets, setNeedsSecrets] = useState<null | { secrets: string[]; how_to: string; docs: string }>(null);
  const [manualPack, setManualPack] = useState<any>(null);

  const openManualMeta = async (reason?: string) => {
    const { data, error } = await supabase.functions.invoke("marketing-publish", {
      body: { action: "meta_ads_url", campaignId: campaign.id, adAccountId: "987701320388405", reason },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    const d: any = data;
    setManualPack(d);
    const text = [
      d.primary_texts?.[0],
      "",
      d.headlines?.[0],
      d.ctas?.[0],
      d.image_url ? `Imagem: ${d.image_url}` : "",
    ].filter(Boolean).join("\n");
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    if (d.open_url) window.open(d.open_url, "_blank");
    toast.success("Anúncio copiado e Ads Manager aberto. Só colas/revês/ativas.");
  };

  const publishMeta = async () => {
    setBusy("meta");
    setNeedsSecrets(null);
    try {
      // 1) Tenta API directa — cria a campanha já dentro da conta Meta
      const { data, error } = await supabase.functions.invoke("marketing-publish", {
        body: { action: "meta_api", campaignId: campaign.id, objective: "OUTCOME_LEADS" },
      });
      if (error) throw error;
      const d: any = data;

      if (d?.not_configured) return await openManualMeta("Meta API sem configuração");
      if (d?.error) return await openManualMeta(d.error);
      if (d?.ok && d?.manage_url) {
        window.open(d.manage_url, "_blank");
        toast.success("Campanha criada no Meta Ads (PAUSED). Abre a rever e ativa.");
        setOpen(false);
        return;
      }
      throw new Error("Resposta inesperada da Meta API");
    } catch (e: any) {
      try {
        await openManualMeta(e?.message ?? "Meta API indisponível");
      } catch (fallbackError: any) {
        toast.error(fallbackError?.message ?? "Falhou");
      }
    } finally { setBusy(null); }
  };

  const publishGoogle = async () => {
    setBusy("google");
    try {
      const { data, error } = await supabase.functions.invoke("marketing-publish", {
        body: { action: "google_ads_csv", campaignId: campaign.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d: any = data;
      const blob = new Blob([d.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = d.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV descarregado. Importa no Google Ads Editor.");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="h-4 w-4 mr-2" /> Publicar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar "{campaign.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A campanha é criada automaticamente na tua conta Meta (em PAUSED — revês e ativas).
        </p>
        <div className="grid gap-3">
          <Button size="lg" onClick={publishMeta} disabled={busy !== null}>
            {busy === "meta" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Facebook className="h-4 w-4 mr-2" />}
            Publicar no Facebook & Instagram
          </Button>
          <Button size="lg" variant="outline" onClick={publishGoogle} disabled={busy !== null}>
            {busy === "google" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Google Ads (descarregar CSV)
          </Button>
        </div>

        {manualPack && (
          <div className="border-t pt-3 mt-2 space-y-3 text-xs">
            <div className="font-semibold text-foreground">Plano rápido sem permissões Meta</div>
            {manualPack.image_url && (
              <img src={manualPack.image_url} alt="Criativo gerado para anúncio Meta" className="w-full rounded-md border object-cover max-h-48" />
            )}
            <div className="grid gap-2">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(manualPack.primary_texts?.[0] ?? "") }>
                <Copy className="h-4 w-4 mr-2" /> Copiar texto principal
              </Button>
              {manualPack.image_url && (
                <Button variant="outline" size="sm" onClick={() => window.open(manualPack.image_url, "_blank")}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Abrir imagem
                </Button>
              )}
            </div>
            <div className="text-muted-foreground whitespace-pre-line">{manualPack.instructions?.join("\n")}</div>
          </div>
        )}

        {needsSecrets && !manualPack && (
          <div className="border-t pt-3 mt-2 space-y-2 text-xs">
            <div className="font-semibold text-foreground">Falta ligar a tua conta Meta (1ª vez)</div>
            <div className="text-muted-foreground">Adiciona estes 3 secrets ao projeto:</div>
            <div className="flex flex-wrap gap-1">
              {needsSecrets.secrets.map((s) => (
                <Badge key={s} variant="outline" className="font-mono text-[10px]">{s}</Badge>
              ))}
            </div>
            <div className="text-muted-foreground whitespace-pre-line">{needsSecrets.how_to}</div>
            {needsSecrets.docs && (
              <a href={needsSecrets.docs} target="_blank" rel="noreferrer" className="text-primary underline">
                Documentação Meta Marketing API ↗
              </a>
            )}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground border-t pt-3">
          <strong>Google Ads:</strong> a API exige developer token aprovado (semanas). Por agora descarregas o CSV e importas no Google Ads Editor.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ AVANÇADO ============
function AdvancedTools({ campaigns, onChanged }: { campaigns: Campaign[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [genPosts, setGenPosts] = useState(false);

  const reoptimize = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-autopilot", {
        body: { action: "optimize", campaignId: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Campanha reescrita pela IA");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setBusyId(null); }
  };

  const generateOrganicPosts = async () => {
    setGenPosts(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-autopilot", {
        body: {
          action: "generate_posts",
          market: "Portugal", weeks: 4, postsPerWeek: 3,
          channels: ["facebook", "instagram"],
          startDate: new Date().toISOString(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${(data as any).count} posts orgânicos criados`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setGenPosts(false); }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Posts orgânicos (não pagos) para FB/IG</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          12 posts (4 semanas) com mix de dicas, casos e features. Para construir audiência sem gastar em ads.
        </p>
        <Button size="sm" onClick={generateOrganicPosts} disabled={genPosts}>
          {genPosts ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Sparkles className="h-3 w-3 mr-2" />}
          Gerar 12 posts orgânicos
        </Button>
      </Card>

      {campaigns.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Reescrever campanha</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Se uma campanha não te convencer, a IA escreve uma nova versão (novos títulos, descrições e keywords).
          </p>
          <div className="space-y-2">
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1">{c.title}</span>
                <Button size="sm" variant="outline" onClick={() => reoptimize(c.id)} disabled={busyId === c.id}>
                  {busyId === c.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                  Reescrever
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

// ============ BIBLIOTECA DE IMAGENS IA ============
type Creative = {
  id: string;
  creative_type: string;
  prompt: string;
  image_url: string | null;
  status: string;
  error: string | null;
  campaign_id: string | null;
  created_at: string;
};

const CREATIVE_TEMPLATES: { value: string; label: string }[] = [
  { value: "modern_shop", label: "Oficina moderna (panorâmica)" },
  { value: "dashboard_overlay", label: "Dashboard em tablet (bancada)" },
  { value: "mechanic_tablet", label: "Mecânico com tablet" },
  { value: "growth_chart", label: "Gráficos de crescimento" },
  { value: "before_after", label: "Antes / Depois (caos vs. organizado)" },
  { value: "team_meeting", label: "Equipa em reunião rápida" },
];

function CreativesLibrary({ campaigns }: { campaigns: Campaign[] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [creativeType, setCreativeType] = useState("modern_shop");
  const [customPrompt, setCustomPrompt] = useState("");
  const [linkCampaign, setLinkCampaign] = useState<string>("none");
  const [size, setSize] = useState("1536x1024");
  const [tier, setTier] = useState("gemini");
  const [generating, setGenerating] = useState(false);
  const [emailDlg, setEmailDlg] = useState<Creative | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("marketing_creatives" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(24);
    setItems((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Auto-poll a cada 4s enquanto houver imagens "generating"
  useEffect(() => {
    const hasPending = items.some((it) => it.status === "generating");
    if (!hasPending) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [items]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-creative", {
        body: {
          creativeType,
          customPrompt: customPrompt.trim() || undefined,
          campaignId: linkCampaign !== "none" ? linkCampaign : null,
          size,
          tier,
          quality: tier === "premium" ? "high" : "medium",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("A gerar… aparece em baixo em 15–60s.");
      setCustomPrompt("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou a gerar");
    } finally { setGenerating(false); }
  };


  const remove = async (id: string) => {
    if (!confirm("Apagar esta imagem?")) return;
    await supabase.from("marketing_creatives" as any).delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    toast.success("URL copiado");
  };

  const downloadImg = async (it: Creative) => {
    if (!it.image_url) return;
    try {
      const res = await fetch(it.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `garageflow-${it.creative_type}-${it.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Descarregada");
    } catch {
      window.open(it.image_url, "_blank");
    }
  };


  return (
    <Card className="p-6 border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="h-5 w-5 text-amber-500" />
        <h2 className="font-semibold">Biblioteca de Imagens IA</h2>
        <Badge variant="outline" className="text-[10px]">{items.length} guardadas</Badge>
        <Button onClick={load} variant="ghost" size="icon" className="ml-auto" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Cria imagens realistas do estilo GarageFlow (oficina moderna, charcoal + âmbar). Ficam guardadas para reutilizares
        em publicações manuais (Meta/IG) ou em campanhas de email.
      </p>

      {/* Gerador */}
      <div className="grid gap-3 md:grid-cols-4 mb-3">
        <div>
          <Label className="text-xs">Template</Label>
          <Select value={creativeType} onValueChange={setCreativeType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CREATIVE_TEMPLATES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Formato</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1536x1024">Paisagem (Meta/Google Ads)</SelectItem>
              <SelectItem value="1024x1024">Quadrado (Instagram)</SelectItem>
              <SelectItem value="1024x1536">Vertical (Story/Reels)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Qualidade</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Grátis (Gemini Nano Banana)</SelectItem>
              <SelectItem value="fast">Rápida (OpenAI mini)</SelectItem>
              <SelectItem value="premium">Premium (OpenAI alta)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Associar a campanha</Label>
          <Select value={linkCampaign} onValueChange={setLinkCampaign}>
            <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-3">
        <Label className="text-xs">Prompt personalizado (opcional — substitui o template)</Label>
        <Textarea
          rows={2}
          placeholder="Ex.: mecânico jovem a explicar orçamento ao cliente no balcão de receção…"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
      </div>
      <div className="flex justify-end mb-4">
        <Button onClick={generate} disabled={generating} className="min-w-[200px]">
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generating ? "A gerar (15–40s)…" : "Gerar imagem"}
        </Button>
      </div>


      {/* Galeria */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
          Ainda sem imagens. Gera a primeira acima ↑
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.id} className="border rounded-md overflow-hidden bg-background">
              {it.status === "ready" && it.image_url ? (
                <img src={it.image_url} alt={it.creative_type} className="w-full aspect-square object-cover bg-muted" />
              ) : it.status === "generating" ? (
                <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> A gerar…
                </div>
              ) : (
                <div className="aspect-square flex items-center justify-center text-xs text-destructive p-2 text-center">
                  Falhou: {it.error?.slice(0, 60) ?? "erro"}
                </div>
              )}
              <div className="p-2 space-y-1">
                <div className="text-[10px] text-muted-foreground truncate">{it.creative_type}</div>
                <div className="flex gap-1 flex-wrap">
                  {it.image_url && (
                    <>
                      <Button size="icon" aria-label="Descarregar (PNG)" variant="ghost" className="h-7 w-7" title="Descarregar (PNG)"
                        onClick={() => downloadImg(it)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" aria-label="Copiar URL" variant="ghost" className="h-7 w-7" title="Copiar URL"
                        onClick={() => copyUrl(it.image_url!)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" aria-label="Abrir em nova janela" variant="ghost" className="h-7 w-7" title="Abrir em nova janela"
                        onClick={() => window.open(it.image_url!, "_blank")}>
                        <ImageIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" aria-label="Usar em email" variant="ghost" className="h-7 w-7" title="Usar em email"
                        onClick={() => setEmailDlg(it)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="icon" aria-label="Apagar" variant="ghost" className="h-7 w-7 ml-auto" title="Apagar"
                    onClick={() => remove(it.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UseInEmailDialog
        creative={emailDlg}
        onClose={() => setEmailDlg(null)}
        onDone={() => { setEmailDlg(null); navigate("/admin/marketing"); }}
      />
    </Card>
  );
}

function UseInEmailDialog({
  creative, onClose, onDone,
}: { creative: Creative | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("erp");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (creative) {
      setName(`Campanha ${creative.creative_type} ${new Date().toLocaleDateString("pt-PT")}`);
      setSubject("");
      setBody("Olá,\n\nTemos novidades para a tua oficina.\n\nA equipa GarageFlow");
    }
  }, [creative]);

  if (!creative) return null;

  const buildHtml = () => {
    const safeBody = body.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <img src="${creative.image_url}" alt="" style="width:100%;border-radius:8px;display:block;margin-bottom:16px" />
  <div style="padding:0 8px;color:#222;line-height:1.6">${safeBody}</div>
</div>`;
  };

  const save = async () => {
    if (!name || !subject || !body) {
      toast.error("Preenche nome, assunto e corpo");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("admin_campaigns" as any).insert({
        name, subject, content_html: buildHtml(),
        audience, status: "draft", created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Rascunho criado em Marketing Global");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!creative} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Usar imagem em campanha de email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {creative.image_url && (
            <img src={creative.image_url} alt="" className="w-full rounded border max-h-48 object-cover" />
          )}
          <div>
            <Label className="text-xs">Nome interno</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: 🚀 Novidades para a tua oficina" />
          </div>
          <div>
            <Label className="text-xs">Audiência</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (ERP + Market)</SelectItem>
                <SelectItem value="erp">Todas oficinas (ERP)</SelectItem>
                <SelectItem value="erp_free">Oficinas FREE/Trial</SelectItem>
                <SelectItem value="erp_paid">Oficinas pagantes</SelectItem>
                <SelectItem value="market">Utilizadores Market</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Corpo (texto simples — a imagem é inserida automaticamente no topo)</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Criar rascunho e abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
