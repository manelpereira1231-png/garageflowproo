import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Search, FileSpreadsheet } from "lucide-react";

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, any>;
}

const ACTION_LABELS: Record<string, string> = {
  shop_created: "Oficina criada",
  shop_suspended: "Oficina suspensa",
  shop_activated: "Oficina ativada",
  shop_deleted: "Oficina eliminada",
  plan_changed: "Plano alterado",
  trial_reset: "Trial reiniciado",
  role_changed: "Role alterado",
  alerts_reset: "Alertas resetados",
  subscription_cancelled: "Subscrição cancelada",
  user_removed: "Utilizador removido",
  user_invited: "Utilizador convidado",
  settings_updated: "Configurações atualizadas",
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setLogs((data as AuditLog[]) || []);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter(log => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (search) {
      const s = search.toLowerCase();
      const label = (ACTION_LABELS[log.action] || log.action).toLowerCase();
      const details = JSON.stringify(log.details).toLowerCase();
      if (!label.includes(s) && !details.includes(s) && !log.entity_type.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ["Data", "Ação", "Entidade", "Detalhes"];
    const rows = filtered.map(log => [
      new Date(log.created_at).toLocaleString("pt-PT"),
      ACTION_LABELS[log.action] || log.action,
      log.entity_type,
      JSON.stringify(log.details),
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.map(c => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionBadge = (action: string) => {
    const colors: Record<string, string> = {
      shop_created: "bg-success/15 text-success border-success/30",
      shop_suspended: "bg-destructive/15 text-destructive border-destructive/30",
      shop_activated: "bg-success/15 text-success border-success/30",
      plan_changed: "bg-primary/15 text-primary border-primary/30",
      trial_reset: "bg-primary/15 text-primary border-primary/30",
      role_changed: "bg-warning/15 text-warning border-warning/30",
    };
    return (
      <Badge variant="outline" className={colors[action] || "bg-muted text-muted-foreground"}>
        {ACTION_LABELS[action] || action}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Logs de Auditoria</h1>
          <p className="text-sm text-muted-foreground">Histórico de ações administrativas</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar nos logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString("pt-PT")}
                </TableCell>
                <TableCell>{actionBadge(log.action)}</TableCell>
                <TableCell className="text-sm">{log.entity_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                  {log.details && Object.keys(log.details).length > 0
                    ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(", ")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
