import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  shop_id: string;
  shop_name: string | null;
  listing_id: string;
  overall_score: number;
  recommendation: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  audit_status: "none" | "queued" | "in_review" | "resolved" | "failed";
  risk_flags: Array<{ code: string; severity: string; msg: string }>;
  completed_at: string | null;
  technician_name: string | null;
};

const FILTERS = [
  { v: "all", l: "Todas" },
  { v: "high", l: "Alto risco" },
  { v: "medium", l: "Risco médio" },
  { v: "low", l: "Risco baixo" },
  { v: "queued", l: "Fila de auditoria" },
  { v: "in_review", l: "Em revisão" },
  { v: "resolved", l: "Resolvidas" },
  { v: "failed", l: "Auditoria falhada" },
];

const levelStyle: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

const auditLabel: Record<string, string> = {
  none: "Sem auditoria",
  queued: "Em fila",
  in_review: "Em revisão",
  resolved: "Resolvida",
  failed: "Falhada",
};

export default function AdminRiskEngine() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [trust, setTrust] = useState<any[]>([]);

  const [shopNames, setShopNames] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: rd, error: re }, { data: td }, { data: sd }] = await Promise.all([
      supabase.rpc("admin_list_risk_inspections" as any, { _filter: filter, _limit: 300 }),
      supabase.from("workshop_trust_scores" as any).select("*").order("score", { ascending: false }).limit(50),
      supabase.from("shops").select("id, name"),
    ]);
    if (re) toast.error(re.message);
    setRows((rd as any) || []);
    setTrust((td as any) || []);
    const map: Record<string, string> = {};
    (sd || []).forEach((s: any) => { map[s.id] = s.name || ""; });
    setShopNames(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.rpc("admin_set_audit_status" as any, { _report_id: id, _new_status: status });
    if (error) return toast.error(error.message);
    toast.success("Estado atualizado");
    load();
  };

  const counts = {
    high: rows.filter((r) => r.risk_level === "high").length,
    queued: rows.filter((r) => r.audit_status === "queued").length,
    failed: rows.filter((r) => r.audit_status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-primary" /> Inspeções &amp; Risk Engine
        </h1>
        <p className="text-sm text-muted-foreground">
          Deteção automática de fraude em inspeções e trust score das oficinas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Alto risco visíveis</p><p className="text-2xl font-bold text-red-500">{counts.high}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Em fila de auditoria</p><p className="text-2xl font-bold text-amber-500">{counts.queued}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Auditorias falhadas</p><p className="text-2xl font-bold text-red-600">{counts.failed}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Inspeções</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma inspeção encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Oficina</th>
                    <th className="text-left py-2 px-2">Score</th>
                    <th className="text-left py-2 px-2">Risco</th>
                    <th className="text-left py-2 px-2">Flags</th>
                    <th className="text-left py-2 px-2">Auditoria</th>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-right py-2 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 px-2 align-top">
                        <p className="font-medium">{r.shop_name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{r.technician_name || ""}</p>
                      </td>
                      <td className="py-2 px-2 align-top">{r.overall_score}/100</td>
                      <td className="py-2 px-2 align-top">
                        <Badge variant="outline" className={levelStyle[r.risk_level]}>
                          {r.risk_score} · {r.risk_level}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 align-top max-w-xs">
                        {r.risk_flags?.length ? (
                          <ul className="space-y-0.5">
                            {r.risk_flags.slice(0, 3).map((f, i) => (
                              <li key={i} className="text-[11px] flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span>{f.msg}</span>
                              </li>
                            ))}
                            {r.risk_flags.length > 3 && <li className="text-[10px] text-muted-foreground">+{r.risk_flags.length - 3} mais</li>}
                          </ul>
                        ) : (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Limpa</span>
                        )}
                      </td>
                      <td className="py-2 px-2 align-top">
                        <Badge variant="secondary" className="text-[10px]">{auditLabel[r.audit_status]}</Badge>
                      </td>
                      <td className="py-2 px-2 align-top text-[11px] text-muted-foreground">
                        {r.completed_at ? new Date(r.completed_at).toLocaleString("pt-PT") : "—"}
                      </td>
                      <td className="py-2 px-2 align-top text-right">
                        <Select value={r.audit_status} onValueChange={(v) => setStatus(r.id, v)}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem auditoria</SelectItem>
                            <SelectItem value="queued">Em fila</SelectItem>
                            <SelectItem value="in_review">Em revisão</SelectItem>
                            <SelectItem value="resolved">Resolvida</SelectItem>
                            <SelectItem value="failed">Falhada</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Trust Score das Oficinas</CardTitle></CardHeader>
        <CardContent>
          {trust.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Oficina</th>
                    <th className="text-left py-2 px-2">Score</th>
                    <th className="text-left py-2 px-2">Nível</th>
                    <th className="text-left py-2 px-2">Inspeções</th>
                    <th className="text-left py-2 px-2">Flagged</th>
                    <th className="text-left py-2 px-2">Aprovação</th>
                    <th className="text-left py-2 px-2">Risco médio</th>
                  </tr>
                </thead>
                <tbody>
                  {trust.map((t: any) => (
                    <tr key={t.shop_id} className="border-b border-border/40">
                      <td className="py-2 px-2 text-sm">{shopNames[t.shop_id] || <span className="font-mono text-[11px] text-muted-foreground">{t.shop_id.slice(0, 8)}…</span>}</td>
                      <td className="py-2 px-2 font-semibold">{t.score}/100</td>
                      <td className="py-2 px-2 capitalize">{t.level}</td>
                      <td className="py-2 px-2">{t.total_inspections}</td>
                      <td className="py-2 px-2 text-amber-600">{t.flagged_inspections}</td>
                      <td className="py-2 px-2">{t.approval_rate}%</td>
                      <td className="py-2 px-2">{t.avg_risk_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
