import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertOctagon, Clock } from "lucide-react";

type Complaint = {
  id: string;
  shop_id: string | null;
  user_id: string | null;
  category: string | null;
  subject: string | null;
  description: string | null;
  status: string;
  severity: string | null;
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
};

const STATUS = ["new", "ack", "in_progress", "resolved", "rejected"];

export default function AdminComplaints() {
  const [list, setList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");
  const [active, setActive] = useState<Complaint | null>(null);
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("complaints" as any).select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "open") q = q.in("status", ["new", "ack", "in_progress"]);
    else if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setList((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "ack" || status === "in_progress") patch.responded_at = new Date().toISOString();
    if (status === "resolved" || status === "rejected") {
      patch.resolved_at = new Date().toISOString();
      patch.resolution_notes = notes || null;
    }
    const { error } = await supabase.from("complaints" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Atualizado");
      setActive(null);
      setNotes("");
      load();
    }
  };

  const slaState = (c: Complaint): { label: string; tone: "ok" | "warn" | "danger" } => {
    if (c.resolved_at) return { label: "Resolvido", tone: "ok" };
    const due = c.sla_resolution_due_at || c.sla_response_due_at;
    if (!due) return { label: "Sem SLA", tone: "ok" };
    const ms = new Date(due).getTime() - Date.now();
    if (ms < 0) return { label: "SLA BREACH", tone: "danger" };
    if (ms < 4 * 3600 * 1000) return { label: "<4h", tone: "warn" };
    return { label: `${Math.round(ms / 3600000)}h`, tone: "ok" };
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><AlertOctagon className="h-6 w-6" />Reclamações</h1>
          <p className="text-sm text-muted-foreground">SLAs calculados via trigger <code>tg_complaints_set_sla</code> à criação.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abertas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      <div className="grid gap-3">
        {list.map(c => {
          const sla = slaState(c);
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={c.severity === "critical" || c.severity === "high" ? "destructive" : "secondary"}>{c.severity ?? "—"}</Badge>
                    <Badge variant="outline">{c.status}</Badge>
                    <Badge variant={sla.tone === "danger" ? "destructive" : sla.tone === "warn" ? "secondary" : "outline"}>
                      <Clock className="h-3 w-3 mr-1" />{sla.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{c.category}</span>
                  </div>
                  <h3 className="font-semibold mt-2">{c.subject || "(sem assunto)"}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(c.created_at).toLocaleString("pt-PT")} · shop {c.shop_id?.slice(0, 8) ?? "—"} · user {c.user_id?.slice(0, 8) ?? "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setActive(c); setNotes(c.resolution_notes ?? ""); }}>Gerir</Button>
              </div>

              {active?.id === c.id && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <Textarea placeholder="Notas de resolução…" value={notes} onChange={e => setNotes(e.target.value)} />
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "ack")}>ACK</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "in_progress")}>Em curso</Button>
                    <Button size="sm" onClick={() => updateStatus(c.id, "resolved")}>Resolver</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(c.id, "rejected")}>Rejeitar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setActive(null); setNotes(""); }}>Cancelar</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {list.length === 0 && !loading && (
          <Card className="p-8 text-center text-muted-foreground">Sem reclamações.</Card>
        )}
      </div>
    </div>
  );
}
