import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Eye, Trash2, Plus, Users, Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

type Audience =
  | "all" | "erp" | "erp_free" | "erp_paid"
  | "market" | "market_sellers" | "market_buyers";

const audienceLabels: Record<Audience, string> = {
  all: "Todos os utilizadores (ERP + Market)",
  erp: "Todas as oficinas (ERP)",
  erp_free: "Oficinas em FREE / Trial",
  erp_paid: "Oficinas pagantes (PRO / GARAGE)",
  market: "Todos os utilizadores Market",
  market_sellers: "Vendedores Market",
  market_buyers: "Compradores Market",
};

interface Campaign {
  id: string;
  name: string;
  subject: string;
  content_html: string;
  audience: string;
  country_filter: string | null;
  status: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  sent_at: string | null;
  created_at: string;
}

export default function AdminMarketing() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const [form, setForm] = useState({
    name: "",
    subject: "",
    content_html: "",
    audience: "all" as Audience,
    country_filter: "",
  });

  const loadCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.subject || !form.content_html) {
      toast({ title: "Campos obrigatórios", description: "Preenche nome, assunto e conteúdo.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("admin_campaigns").insert({
      name: form.name,
      subject: form.subject,
      content_html: form.content_html,
      audience: form.audience,
      country_filter: form.country_filter || null,
      status: "draft",
      created_by: user?.id,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Campanha criada", description: "Rascunho guardado. Podes enviá-la quando quiseres." });
    setForm({ name: "", subject: "", content_html: "", audience: "all", country_filter: "" });
    setOpenDialog(false);
    loadCampaigns();
  };

  const handleSend = async (campaign: Campaign) => {
    if (!confirm(`Vais enviar "${campaign.name}" para ${audienceLabels[campaign.audience as Audience]}.\n\nIsto NÃO pode ser revertido. Confirmas?`)) return;
    setSending(campaign.id);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-send-campaign", {
        body: { campaign_id: campaign.id },
      });
      if (error) throw new Error(error.message || "Falha ao enviar");
      if (result?.error) throw new Error(result.error);
      toast({
        title: "Campanha enviada",
        description: `${result.sent} enviados / ${result.failed} falhas (de ${result.total})`,
      });
      loadCampaigns();
    } catch (err: any) {
      toast({ title: "Erro no envio", description: err.message, variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar esta campanha?")) return;
    await supabase.from("admin_campaigns").delete().eq("id", id);
    toast({ title: "Campanha apagada" });
    loadCampaigns();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: any; icon: any }> = {
      draft: { label: "Rascunho", variant: "secondary", icon: Clock },
      sending: { label: "A enviar...", variant: "default", icon: Send },
      sent: { label: "Enviada", variant: "default", icon: CheckCircle2 },
      failed: { label: "Falhou", variant: "destructive", icon: XCircle },
    };
    const cfg = map[status] || map.draft;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="w-3 h-3" />{cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Marketing Global
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envia campanhas de email a todos os utilizadores do ecossistema (GarageFlow ERP + Market).
          </p>
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Nova Campanha</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Campanha de Marketing</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome interno *</Label>
                <Input
                  placeholder="Ex: Lançamento Carity Espanha - Abril 2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Audiência *</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v as Audience })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(audienceLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>País (opcional)</Label>
                <Input
                  placeholder="PT, BR, ES, FR... (vazio = todos)"
                  value={form.country_filter}
                  onChange={(e) => setForm({ ...form, country_filter: e.target.value.toUpperCase() })}
                  maxLength={2}
                />
              </div>
              <div>
                <Label>Assunto do email *</Label>
                <Input
                  placeholder="Ex: 🚀 Novidade: agora podes vender no Carity"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div>
                <Label>Conteúdo HTML *</Label>
                <Textarea
                  placeholder="<h1>Olá!</h1><p>O teu conteúdo aqui...</p>"
                  value={form.content_html}
                  onChange={(e) => setForm({ ...form, content_html: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Suporta HTML completo. Será enviado a partir de <code>noreply@garageflow.pt</code>.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "A guardar..." : "Guardar como rascunho"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>
            Lista de todas as campanhas criadas. Podes pré-visualizar, enviar ou apagar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar...</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sem campanhas ainda. Cria a primeira!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="border border-border rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{c.name}</h3>
                      {statusBadge(c.status)}
                      <Badge variant="outline" className="text-xs">
                        {audienceLabels[c.audience as Audience] || c.audience}
                      </Badge>
                      {c.country_filter && <Badge variant="outline" className="text-xs">{c.country_filter}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{c.subject}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.recipients_count} destinatários</span>
                      {c.sent_count > 0 && <span className="text-emerald-600">✓ {c.sent_count} enviados</span>}
                      {c.failed_count > 0 && <span className="text-destructive">✗ {c.failed_count} falhas</span>}
                      <span>Criado {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: pt })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setPreviewCampaign(c)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {c.status === "draft" && (
                      <Button size="sm" onClick={() => handleSend(c)} disabled={sending === c.id} className="gap-1">
                        <Send className="w-4 h-4" />
                        {sending === c.id ? "A enviar..." : "Enviar"}
                      </Button>
                    )}
                    {c.status !== "sending" && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewCampaign} onOpenChange={(o) => !o && setPreviewCampaign(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewCampaign?.name}</DialogTitle>
            <CardDescription>{previewCampaign?.subject}</CardDescription>
          </DialogHeader>
          <div className="border border-border rounded-lg p-4 bg-white text-black overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: previewCampaign?.content_html || "" }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
