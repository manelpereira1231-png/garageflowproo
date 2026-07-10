import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Phone, Mail, Calendar, Sparkles, Clock, Trophy, XCircle, Users } from "lucide-react";

type Demo = {
  id: string; name: string; shop_name: string; email: string; phone: string;
  city?: string; employees?: string; current_software?: string;
  best_contact_time?: string; notes?: string;
  status: string; source?: string;
  contacted_at?: string; scheduled_at?: string; converted_at?: string;
  archived_at?: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Nova Demonstração Solicitada", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  contacted: { label: "Em Contacto", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  scheduled: { label: "Demonstração Agendada", tone: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  done: { label: "Realizada", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  converted: { label: "Convertido em Cliente", tone: "bg-green-600/20 text-green-700 dark:text-green-400" },
  cancelled: { label: "Cancelado", tone: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

export default function DemoRequests({ title }: { title?: string }) {
  const [rows, setRows] = useState<Demo[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Demo | null>(null);
  const [scheduledInput, setScheduledInput] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [notesEdit, setNotesEdit] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("demo_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as unknown as Demo[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("demo-requests-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (detail) {
      setNotesEdit(detail.notes || "");
      setScheduledInput(detail.scheduled_at ? new Date(detail.scheduled_at).toISOString().slice(0, 16) : "");
    }
  }, [detail]);

  const kpis = useMemo(() => {
    const g = (s: string) => rows.filter((r) => r.status === s).length;
    return { total: rows.length, novos: g("new"), contactados: g("contacted"), agendados: g("scheduled"), convertidos: g("converted"), cancelados: g("cancelled") };
  }, [rows]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      const isArchived = !!r.archived_at;
      if (!showArchived && isArchived) return false;
      if (showArchived && !isArchived) return false;
      if (filter !== "all" && r.status !== filter) return false;
      if (!t) return true;
      return [r.name, r.shop_name, r.email, r.phone, r.city, r.current_software]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
    });
  }, [rows, q, filter, showArchived]);

  const updateStatus = async (id: string, newStatus: string) => {
    const patch: any = { status: newStatus };
    if (newStatus === "contacted") patch.contacted_at = new Date().toISOString();
    if (newStatus === "converted") patch.converted_at = new Date().toISOString();
    const { error } = await supabase.from("demo_requests" as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estado atualizado");
  };

  const archiveOne = async (id: string, archive = true) => {
    const { error } = await supabase.from("demo_requests" as any)
      .update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(archive ? "Pedido arquivado" : "Pedido reactivado");
  };

  const saveDetail = async () => {
    if (!detail) return;
    const patch: any = { notes: notesEdit };
    if (scheduledInput) {
      patch.scheduled_at = new Date(scheduledInput).toISOString();
      if (detail.status === "new" || detail.status === "contacted") patch.status = "scheduled";
    }
    const { error } = await supabase.from("demo_requests" as any).update(patch).eq("id", detail.id);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    setDetail(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{title || "Pedidos de Demonstração"}</h2>
        <p className="text-sm text-muted-foreground">
          Todos os pedidos recebidos em <code className="px-1 py-0.5 rounded bg-muted text-xs">garageflow.pt/demo</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi icon={Users} label="Total" value={kpis.total} />
        <Kpi icon={Sparkles} label="Novos" value={kpis.novos} tone="text-blue-600 dark:text-blue-400" />
        <Kpi icon={Phone} label="Em contacto" value={kpis.contactados} tone="text-amber-600 dark:text-amber-400" />
        <Kpi icon={Calendar} label="Agendados" value={kpis.agendados} tone="text-purple-600 dark:text-purple-400" />
        <Kpi icon={Trophy} label="Convertidos" value={kpis.convertidos} tone="text-green-600 dark:text-green-400" />
        <Kpi icon={XCircle} label="Cancelados" value={kpis.cancelados} tone="text-red-600 dark:text-red-400" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Procurar oficina, nome, email, telefone…" className="pl-9"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Ver activos" : "Ver arquivados"}
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">A carregar…</div>}

      {!loading && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Oficina / Contacto</th>
                    <th className="text-left p-3">Contactos</th>
                    <th className="text-left p-3">Horário</th>
                    <th className="text-left p-3">Estado</th>
                    <th className="text-left p-3">Pedido</th>
                    <th className="text-left p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const s = STATUS[r.status] || { label: r.status, tone: "" };
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{r.shop_name}</div>
                          <div className="text-xs text-muted-foreground">{r.name}{r.city ? ` · ${r.city}` : ""}</div>
                        </td>
                        <td className="p-3 text-xs">
                          <a href={`mailto:${r.email}`} className="hover:underline block">{r.email}</a>
                          <a href={`tel:${r.phone}`} className="text-muted-foreground hover:underline">{r.phone}</a>
                        </td>
                        <td className="p-3 text-xs">
                          {r.best_contact_time || "—"}
                          {r.scheduled_at && (
                            <div className="text-purple-600 dark:text-purple-400">
                              📅 {new Date(r.scheduled_at).toLocaleString("pt-PT")}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge className={`${s.tone} mt-1`}>{s.label}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-PT")}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" asChild title="Ligar">
                              <a href={`tel:${r.phone}`}><Phone className="w-4 h-4" /></a>
                            </Button>
                            <Button size="icon" variant="ghost" asChild title="Enviar email">
                              <a href={`mailto:${r.email}`}><Mail className="w-4 h-4" /></a>
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                              <Calendar className="w-4 h-4 mr-1" /> Agendar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                        Sem pedidos ainda. Partilhe o link <strong>garageflow.pt/demo</strong>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.shop_name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Contacto:</span> {detail.name}</div>
                <div><span className="text-muted-foreground">Cidade:</span> {detail.city || "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {detail.email}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {detail.phone}</div>
                <div><span className="text-muted-foreground">Colaboradores:</span> {detail.employees || "—"}</div>
                <div><span className="text-muted-foreground">Software atual:</span> {detail.current_software || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Melhor horário:</span> {detail.best_contact_time || "—"}</div>
              </div>

              <div>
                <label className="text-xs font-medium">Agendar demonstração</label>
                <Input type="datetime-local" value={scheduledInput}
                  onChange={(e) => setScheduledInput(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-medium">Observações internas</label>
                <Textarea rows={4} value={notesEdit} onChange={(e) => setNotesEdit(e.target.value)} />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDetail(null)}>Cancelar</Button>
                <Button onClick={saveDetail}>Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="w-3.5 h-3.5" /> {label}
        </div>
        <div className={`text-xl font-bold mt-1 ${tone || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
