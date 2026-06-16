import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MessageCircle, RefreshCw, TrendingUp, Users, Target, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

type Lead = {
  id: string;
  workshop_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string;
  city: string | null;
  team_size: string | null;
  current_tool: string | null;
  notes: string | null;
  status: string;
  utm_source: string | null;
  created_at: string;
  contacted_at: string | null;
  demo_at: string | null;
  activated_at: string | null;
};

const STATUSES = [
  { value: "new", label: "Novo", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { value: "contacted", label: "Contactado", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { value: "demo", label: "Demo agendada", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  { value: "active", label: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { value: "lost", label: "Perdido", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
];

const statusInfo = (s: string) => STATUSES.find((x) => x.value === s) || STATUSES[0];

export default function AdminGrowth() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pilot_leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Erro a carregar leads");
      return;
    }
    setLeads((data || []) as Lead[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("pilot_leads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pilot_leads" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "contacted") patch.contacted_at = new Date().toISOString();
    if (newStatus === "demo") patch.demo_at = new Date().toISOString();
    if (newStatus === "active") patch.activated_at = new Date().toISOString();
    const { error } = await supabase.from("pilot_leads").update(patch).eq("id", id);
    if (error) { toast.error("Falha ao atualizar"); return; }
    toast.success("Estado atualizado");
  };

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return [l.workshop_name, l.contact_name, l.phone, l.city, l.email]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      }
      return true;
    });
  }, [leads, filter, search]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const by = (s: string) => leads.filter((l) => l.status === s).length;
    const active = by("active");
    const conv = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, new: by("new"), demo: by("demo"), active, conv };
  }, [leads]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Helmet><title>Growth · Oficinas Piloto | Admin</title></Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Growth · Oficinas Piloto</h1>
          <p className="text-sm text-muted-foreground">Pipeline de aquisição automática via <code>/oficinas-piloto</code></p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Users, label: "Total leads", value: kpis.total },
          { icon: Target, label: "Novos", value: kpis.new },
          { icon: TrendingUp, label: "Demos", value: kpis.demo },
          { icon: CheckCircle2, label: "Ativos", value: kpis.active },
          { icon: TrendingUp, label: "Conversão", value: `${kpis.conv}%` },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <k.icon className="w-4 h-4 text-amber-500 mb-2" />
              <div className="text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Pesquisar oficina, contacto, telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader><CardTitle>Leads ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Sem leads ainda. Partilha <code>/oficinas-piloto</code> e regressa aqui.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((l) => {
                const info = statusInfo(l.status);
                return (
                  <div key={l.id} className="p-4 hover:bg-muted/30 transition">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{l.workshop_name}</h3>
                          <Badge variant="outline" className={info.color}>{info.label}</Badge>
                          {l.utm_source && <Badge variant="secondary" className="text-xs">{l.utm_source}</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {l.contact_name && <span>{l.contact_name} · </span>}
                          {l.city && <span>{l.city} · </span>}
                          {l.team_size && <span>{l.team_size} mecânicos · </span>}
                          {l.current_tool && <span>usa {l.current_tool}</span>}
                        </div>
                        {l.notes && <p className="text-sm mt-2 text-zinc-300 italic">"{l.notes}"</p>}
                        <div className="text-xs text-muted-foreground mt-2">
                          há {formatDistanceToNow(new Date(l.created_at), { locale: pt })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <div className="flex gap-1">
                          <a href={`tel:${l.phone}`}><Button size="sm" variant="outline"><Phone className="w-3.5 h-3.5" /></Button></a>
                          <a
                            href={`https://wa.me/${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${l.contact_name || ""}, sou da GarageFlow. Vi a tua candidatura ao piloto.`)}`}
                            target="_blank" rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline" className="text-emerald-500"><MessageCircle className="w-3.5 h-3.5" /></Button>
                          </a>
                          {l.email && (
                            <a href={`mailto:${l.email}`}><Button size="sm" variant="outline"><Mail className="w-3.5 h-3.5" /></Button></a>
                          )}
                        </div>
                        <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
