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
  Send, ChevronDown, Trash2, Wand2, Image as ImageIcon, Calendar,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  status: string;
  created_at: string;
};

const fmtEUR = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

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
      const { data, error } = await supabase.functions.invoke("marketing-autopilot", {
        body: { action: "generate", market, monthlyBudgetEur: Number(budget), count: 3 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
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

      if (d?.not_configured) {
        setNeedsSecrets({
          secrets: d.required_secrets ?? [],
          how_to: d.how_to ?? "",
          docs: d.docs ?? "",
        });
        return;
      }
      if (d?.error) throw new Error(d.error);
      if (d?.ok && d?.manage_url) {
        window.open(d.manage_url, "_blank");
        toast.success("Campanha criada no Meta Ads (PAUSED). Abre a rever e ativa.");
        setOpen(false);
        return;
      }
      throw new Error("Resposta inesperada da Meta API");
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
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

        {needsSecrets && (
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
