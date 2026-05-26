import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Plus, Edit, Trash2, Calendar, Eye, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  keyword: string;
  meta_title: string;
  meta_description: string;
  status: "draft" | "scheduled" | "published" | "archived";
  scheduled_at: string | null;
  published_at: string | null;
  views_count: number;
  reading_minutes: number;
  source: "manual" | "ai";
  created_at: string;
};

const CATEGORIES = ["Gestão", "Faturação", "ERP", "Clientes", "Viaturas", "Produtividade", "Market"];

function slugify(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

export default function AdminSeoBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("draft");
  const [editing, setEditing] = useState<Post | null>(null);
  const [showGen, setShowGen] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genIntent, setGenIntent] = useState("solucao");
  const [genCategory, setGenCategory] = useState("Gestão");
  const [generating, setGenerating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("seo_blog_posts" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro a carregar", description: error.message, variant: "destructive" });
    setPosts((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const byStatus = (s: string) => posts.filter(p => p.status === s);
  const stats = {
    draft: byStatus("draft").length,
    scheduled: byStatus("scheduled").length,
    published: byStatus("published").length,
    archived: byStatus("archived").length,
    totalViews: posts.reduce((a, p) => a + (p.views_count || 0), 0),
    topPost: [...posts].sort((a, b) => (b.views_count || 0) - (a.views_count || 0))[0],
  };

  async function generateAI() {
    if (!genTopic.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-generate-article", {
        body: { topic: genTopic, intent: genIntent, category: genCategory, save: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Artigo gerado", description: "Adicionado aos rascunhos." });
      setShowGen(false);
      setGenTopic("");
      load();
    } catch (e: any) {
      toast({ title: "Falha", description: e.message || "Erro", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function savePost(p: Partial<Post> & { id?: string }) {
    if (!p.title || !p.content) {
      toast({ title: "Faltam campos", description: "Título e conteúdo são obrigatórios", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: p.title,
      slug: p.slug || slugify(p.title),
      excerpt: p.excerpt || "",
      content: p.content,
      category: p.category || "Gestão",
      keyword: p.keyword || "",
      meta_title: p.meta_title || p.title.slice(0, 60),
      meta_description: p.meta_description || (p.excerpt || "").slice(0, 160),
      reading_minutes: p.reading_minutes || 5,
      status: p.status || "draft",
      scheduled_at: p.scheduled_at || null,
      published_at: p.status === "published" ? (p.published_at || new Date().toISOString()) : p.published_at || null,
    };
    if (p.id) {
      const { error } = await supabase.from("seo_blog_posts" as any).update(payload).eq("id", p.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      payload.source = "manual";
      const { error } = await supabase.from("seo_blog_posts" as any).insert(payload);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    toast({ title: "Guardado" });
    setEditing(null);
    setShowNew(false);
    load();
  }

  async function setStatus(id: string, status: Post["status"]) {
    const patch: any = { status };
    if (status === "published") patch.published_at = new Date().toISOString();
    const { error } = await supabase.from("seo_blog_posts" as any).update(patch).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminar artigo definitivamente?")) return;
    const { error } = await supabase.from("seo_blog_posts" as any).delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog SEO</h1>
          <p className="text-sm text-muted-foreground">Motor de conteúdo SEO — Portugal</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowGen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" /> Gerar com IA
          </Button>
          <Button variant="outline" onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo artigo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Rascunhos" value={stats.draft} />
        <Stat label="Agendados" value={stats.scheduled} />
        <Stat label="Publicados" value={stats.published} />
        <Stat label="Arquivados" value={stats.archived} />
        <Stat label="Visitas totais" value={stats.totalViews} />
      </div>

      {stats.topPost && (
        <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Artigo com mais visitas</p>
            <p className="font-semibold">{stats.topPost.title}</p>
          </div>
          <Badge variant="secondary">{stats.topPost.views_count} visitas</Badge>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="draft">Rascunhos ({stats.draft})</TabsTrigger>
          <TabsTrigger value="scheduled">Agendados ({stats.scheduled})</TabsTrigger>
          <TabsTrigger value="published">Publicados ({stats.published})</TabsTrigger>
          <TabsTrigger value="archived">Arquivados ({stats.archived})</TabsTrigger>
        </TabsList>
        {(["draft", "scheduled", "published", "archived"] as const).map(s => (
          <TabsContent key={s} value={s} className="space-y-2 mt-4">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : byStatus(s).length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Sem artigos nesta secção.
              </Card>
            ) : (
              byStatus(s).map(p => (
                <Card key={p.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{p.title}</h3>
                      <Badge variant="outline" className="text-xs">{p.category}</Badge>
                      {p.source === "ai" && <Badge className="text-xs gap-1"><Sparkles className="w-3 h-3" />IA</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">/blog/{p.slug} · {p.reading_minutes} min · {p.views_count} visitas</p>
                    {p.scheduled_at && s === "scheduled" && (
                      <p className="text-xs text-amber-600 mt-1">📅 {new Date(p.scheduled_at).toLocaleString("pt-PT")}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {p.status === "published" && (
                      <Link to={`/blog/${p.slug}`} target="_blank">
                        <Button size="sm" variant="ghost"><ExternalLink className="w-4 h-4" /></Button>
                      </Link>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Edit className="w-4 h-4" /></Button>
                    {s !== "published" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "published")}>Publicar</Button>
                    )}
                    {s === "published" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "draft")}>Despublicar</Button>
                    )}
                    {s !== "archived" && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(p.id, "archived")}>Arquivar</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* AI Generator */}
      <Dialog open={showGen} onOpenChange={setShowGen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Gerar artigo com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Tema ou keyword</label>
              <Input value={genTopic} onChange={e => setGenTopic(e.target.value)} placeholder="ex: gestão oficina automóvel em Portugal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Intenção</label>
                <Select value={genIntent} onValueChange={setGenIntent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="problema">Problema</SelectItem>
                    <SelectItem value="solucao">Solução</SelectItem>
                    <SelectItem value="comparativo">Comparativo</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={genCategory} onValueChange={setGenCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">O artigo é criado como rascunho. Revê e publica manualmente ou agenda.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGen(false)}>Cancelar</Button>
            <Button onClick={generateAI} disabled={generating || !genTopic.trim()}>
              {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A gerar...</> : <>Gerar artigo</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New / Edit */}
      <PostEditor
        open={!!editing || showNew}
        post={editing}
        onClose={() => { setEditing(null); setShowNew(false); }}
        onSave={savePost}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

function PostEditor({ open, post, onClose, onSave }: { open: boolean; post: Post | null; onClose: () => void; onSave: (p: Partial<Post> & { id?: string }) => void }) {
  const [form, setForm] = useState<Partial<Post>>({});
  useEffect(() => {
    setForm(post ?? { category: "Gestão", reading_minutes: 5, status: "draft" });
  }, [post, open]);

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? "Editar artigo" : "Novo artigo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Slug" value={form.slug || ""} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} />
            <Select value={form.category || "Gestão"} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input placeholder="Keyword principal" value={form.keyword || ""} onChange={e => setForm({ ...form, keyword: e.target.value })} />
          <Textarea placeholder="Resumo (excerpt)" value={form.excerpt || ""} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={2} />
          <Textarea placeholder="Conteúdo (markdown)" value={form.content || ""} onChange={e => setForm({ ...form, content: e.target.value })} rows={14} className="font-mono text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Meta title" value={form.meta_title || ""} onChange={e => setForm({ ...form, meta_title: e.target.value })} />
            <Input placeholder="Meta description" value={form.meta_description || ""} onChange={e => setForm({ ...form, meta_description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Min leitura</label>
              <Input type="number" min={1} value={form.reading_minutes || 5} onChange={e => setForm({ ...form, reading_minutes: parseInt(e.target.value) || 5 })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select value={form.status || "draft"} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Agendar para</label>
              <Input type="datetime-local" value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ""} onChange={e => setForm({ ...form, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null, status: e.target.value ? "scheduled" : form.status })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form as any)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
