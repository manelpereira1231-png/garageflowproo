import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LifeBuoy, Mail, Phone, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

type Ticket = {
  id: string;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  context: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-700",
  normal: "bg-blue-500/15 text-blue-700",
  high: "bg-orange-500/15 text-orange-700",
  urgent: "bg-red-500/15 text-red-700",
};

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterContext, setFilterContext] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Erro a carregar tickets");
    setTickets((data as unknown as Ticket[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("support_tickets_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = tickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterContext !== "all" && t.context !== filterContext) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.subject.toLowerCase().includes(q) &&
        !t.message.toLowerCase().includes(q) &&
        !t.contact_email.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    urgent: tickets.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  const updateTicket = async (id: string, patch: Partial<Ticket>) => {
    const { error } = await supabase.from("support_tickets" as any).update(patch).eq("id", id);
    if (error) { toast.error("Erro a atualizar"); return; }
    toast.success("Atualizado");
    load();
  };

  const sendResponse = async () => {
    if (!selected || !response.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("support_tickets" as any)
      .update({
        admin_response: response,
        responded_at: new Date().toISOString(),
        responded_by: user?.id,
        status: "resolved",
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) { toast.error("Erro a guardar resposta"); return; }
    toast.success("Resposta guardada. Envie também por email se quiser contactar o utilizador diretamente.");
    setResponse("");
    setSelected(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LifeBuoy className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Suporte ao Utilizador</h1>
          <p className="text-sm text-muted-foreground">Tickets recebidos do ERP e do Market</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Abertos</p><p className="text-2xl font-bold text-amber-600">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Urgentes</p><p className="text-2xl font-bold text-red-600">{stats.urgent}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolvidos</p><p className="text-2xl font-bold text-emerald-600">{stats.resolved}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="in_progress">Em curso</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterContext} onValueChange={setFilterContext}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas plataformas</SelectItem>
                <SelectItem value="erp">ERP</SelectItem>
                <SelectItem value="market">Market</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Sem tickets.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((t) => (
                <button key={t.id} onClick={() => { setSelected(t); setResponse(t.admin_response || ""); }} className="w-full text-left p-4 hover:bg-accent/50 transition flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={STATUS_COLORS[t.status] || ""}>{t.status}</Badge>
                      <Badge className={PRIORITY_COLORS[t.priority] || ""} variant="outline">{t.priority}</Badge>
                      <Badge variant="outline">{t.context === "market" ? "Market" : "ERP"}</Badge>
                      <span className="text-xs text-muted-foreground">{t.category}</span>
                    </div>
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.contact_email} {t.contact_name ? `• ${t.contact_name}` : ""}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: pt })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className={STATUS_COLORS[selected.status] || ""}>{selected.status}</Badge>
                    <Badge className={PRIORITY_COLORS[selected.priority] || ""} variant="outline">{selected.priority}</Badge>
                    <Badge variant="outline">{selected.context === "market" ? "Market" : "ERP"}</Badge>
                  </div>
                  <CardTitle className="text-lg">{selected.subject}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(selected.created_at).toLocaleString("pt-PT")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /><a href={`mailto:${selected.contact_email}`} className="text-primary hover:underline">{selected.contact_email}</a></p>
                {selected.contact_phone && (
                  <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /><a href={`tel:${selected.contact_phone}`} className="text-primary hover:underline">{selected.contact_phone}</a></p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">MENSAGEM</p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">{selected.message}</div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">RESPOSTA / NOTAS INTERNAS</p>
                <Textarea rows={5} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Escreva a resposta ou notas internas..." />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={selected.status} onValueChange={(v) => updateTicket(selected.id, { status: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="in_progress">Em curso</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                  </SelectContent>
                </Select>
                <Button asChild variant="outline">
                  <a href={`mailto:${selected.contact_email}?subject=Re: ${encodeURIComponent(selected.subject)}`}>
                    <Mail className="w-4 h-4 mr-2" />Responder por email
                  </a>
                </Button>
                <Button onClick={sendResponse} disabled={saving || !response.trim()}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {saving ? "A guardar..." : "Guardar e marcar resolvido"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
