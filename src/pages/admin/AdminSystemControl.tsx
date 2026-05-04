import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, ToggleLeft, Plus, Trash2, Sparkles, Pause, Play, Eye, Globe } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FeatureFlag {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  countries: string[];
  rollout_percent: number;
  category: string;
  updated_at: string;
}

interface Broadcast {
  id: string;
  title: string;
  message: string;
  level: string;
  audience: string;
  country_filter: string | null;
  link_url: string | null;
  link_label: string | null;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  views_count: number;
  dismissals_count: number;
  created_at: string;
}

export default function AdminSystemControl() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    message: "",
    level: "info",
    audience: "all",
    link_url: "",
    link_label: "",
    ends_at: "",
  });

  const load = async () => {
    setLoading(true);
    const [f, b] = await Promise.all([
      supabase.from("system_feature_flags").select("*").order("category").order("label"),
      supabase.from("system_broadcasts").select("*").order("created_at", { ascending: false }),
    ]);
    setFlags((f.data as any) || []);
    setBroadcasts((b.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleFlag = async (flag: FeatureFlag) => {
    const next = !flag.enabled;
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: next } : f));
    const { error } = await supabase
      .from("system_feature_flags")
      .update({ enabled: next })
      .eq("id", flag.id);
    if (error) {
      toast.error("Falha ao atualizar");
      load();
    } else {
      toast.success(`${flag.label}: ${next ? "ATIVADO" : "DESATIVADO"}`);
    }
  };

  const updateRollout = async (flag: FeatureFlag, percent: number) => {
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, rollout_percent: percent } : f));
    await supabase.from("system_feature_flags").update({ rollout_percent: percent }).eq("id", flag.id);
  };

  const createBroadcast = async () => {
    if (!draft.title || !draft.message) { toast.error("Título e mensagem obrigatórios"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      title: draft.title,
      message: draft.message,
      level: draft.level,
      audience: draft.audience,
      link_url: draft.link_url || null,
      link_label: draft.link_label || null,
      ends_at: draft.ends_at || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("system_broadcasts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Broadcast publicado em todo o sistema");
    setCreateOpen(false);
    setDraft({ title: "", message: "", level: "info", audience: "all", link_url: "", link_label: "", ends_at: "" });
    load();
  };

  const toggleBroadcast = async (b: Broadcast) => {
    await supabase.from("system_broadcasts").update({ active: !b.active }).eq("id", b.id);
    load();
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm("Eliminar broadcast definitivamente?")) return;
    await supabase.from("system_broadcasts").delete().eq("id", id);
    toast.success("Broadcast eliminado");
    load();
  };

  const groupedFlags = flags.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Controlo de Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">Feature flags, kill-switches e comunicações in-app em produção.</p>
      </div>

      <Tabs defaultValue="flags" className="w-full">
        <TabsList>
          <TabsTrigger value="flags"><ToggleLeft className="w-4 h-4 mr-2" />Funcionalidades</TabsTrigger>
          <TabsTrigger value="broadcasts"><Megaphone className="w-4 h-4 mr-2" />Broadcasts</TabsTrigger>
        </TabsList>

        {/* FEATURE FLAGS */}
        <TabsContent value="flags" className="space-y-6 mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : Object.keys(groupedFlags).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem feature flags configuradas.</p>
          ) : (
            Object.entries(groupedFlags).map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">{category}</CardTitle>
                  <CardDescription>{items.length} interruptor(es) — alterações aplicam-se imediatamente em produção</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map(flag => (
                    <div key={flag.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-card/50 hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{flag.label}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{flag.key}</Badge>
                          {flag.enabled ? <Badge className="bg-success/15 text-success border-success/30 text-[10px]">ATIVO</Badge> : <Badge variant="secondary" className="text-[10px]">DESATIVADO</Badge>}
                        </div>
                        {flag.description && <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <Label className="text-[10px] text-muted-foreground">Rollout</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={flag.rollout_percent}
                            onChange={(e) => updateRollout(flag, Math.min(100, Math.max(0, Number(e.target.value))))}
                            className="h-7 w-20 text-xs"
                          />
                          <span className="text-[10px] text-muted-foreground">%</span>
                        </div>
                      </div>
                      <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* BROADCASTS */}
        <TabsContent value="broadcasts" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Comunicações In-App</h2>
              <p className="text-xs text-muted-foreground">Aparecem no topo de todas as páginas para a audiência selecionada</p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Novo Broadcast</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Publicar comunicação</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Título</Label>
                    <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Ex: Manutenção planeada" />
                  </div>
                  <div>
                    <Label>Mensagem</Label>
                    <Textarea value={draft.message} onChange={e => setDraft(d => ({ ...d, message: e.target.value }))} rows={3} placeholder="Detalhes para o utilizador" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nível</Label>
                      <Select value={draft.level} onValueChange={(v) => setDraft(d => ({ ...d, level: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Informação</SelectItem>
                          <SelectItem value="success">Sucesso</SelectItem>
                          <SelectItem value="warning">Aviso</SelectItem>
                          <SelectItem value="error">Crítico</SelectItem>
                          <SelectItem value="promo">Promoção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Audiência</Label>
                      <Select value={draft.audience} onValueChange={(v) => setDraft(d => ({ ...d, audience: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos (ERP + Market)</SelectItem>
                          <SelectItem value="erp">Apenas ERP</SelectItem>
                          <SelectItem value="market">Apenas Market</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Link (opcional)</Label>
                      <Input value={draft.link_url} onChange={e => setDraft(d => ({ ...d, link_url: e.target.value }))} placeholder="/billing ou https://…" />
                    </div>
                    <div>
                      <Label>Texto do link</Label>
                      <Input value={draft.link_label} onChange={e => setDraft(d => ({ ...d, link_label: e.target.value }))} placeholder="Saber mais" />
                    </div>
                  </div>
                  <div>
                    <Label>Termina em (opcional)</Label>
                    <Input type="datetime-local" value={draft.ends_at} onChange={e => setDraft(d => ({ ...d, ends_at: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={createBroadcast}><Sparkles className="w-4 h-4 mr-2" />Publicar agora</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Audiência</TableHead>
                    <TableHead className="text-right">Vistas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcasts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem broadcasts publicados</TableCell></TableRow>
                  ) : broadcasts.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{b.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">{b.message}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-[10px]">{b.level}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{b.audience}</Badge></TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        <Eye className="inline w-3 h-3 mr-1" />{b.views_count}
                      </TableCell>
                      <TableCell>
                        {b.active ? <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Ao vivo</Badge> : <Badge variant="secondary" className="text-[10px]">Pausado</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => toggleBroadcast(b)} title={b.active ? "Pausar" : "Ativar"}>
                            {b.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteBroadcast(b.id)} title="Eliminar">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
