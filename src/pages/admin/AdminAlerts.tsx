import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface AlertRow {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  due_date: string | null;
  created_at: string;
  shop_name: string;
  shop_id: string;
}

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");

  const fetchAlerts = async () => {
    setLoading(true);
    const [alertsRes, shopsRes] = await Promise.all([
      supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("shops").select("id, name"),
    ]);
    const shopMap = new Map<string, string>();
    (shopsRes.data || []).forEach(s => shopMap.set(s.id, s.name));

    setAlerts((alertsRes.data || []).map(a => ({
      ...a,
      shop_name: shopMap.get(a.shop_id) || "—",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const resolveAlert = async (alertId: string) => {
    await supabase.from("alerts").update({ status: "resolved" }).eq("id", alertId);
    fetchAlerts();
  };

  const resolveAll = async () => {
    await supabase.from("alerts").update({ status: "resolved" }).eq("status", "pending");
    fetchAlerts();
  };

  const types = [...new Set(alerts.map(a => a.type))];

  const filtered = alerts.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const pendingCount = alerts.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Alertas & Notificações</h1>
          <p className="text-sm text-muted-foreground">{pendingCount} alertas pendentes no sistema</p>
        </div>
        {pendingCount > 0 && (
          <Button onClick={resolveAll} variant="outline" size="sm" className="gap-2">
            <CheckCircle className="w-4 h-4" /> Resolver Todos
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oficina</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Data Limite</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(alert => (
              <TableRow key={alert.id}>
                <TableCell className="font-medium text-sm">{alert.shop_name}</TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{alert.message}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{alert.type}</Badge>
                </TableCell>
                <TableCell>
                  {alert.status === 'pending' ? (
                    <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                      <Clock className="w-3 h-3 mr-1" /> Pendente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                      <CheckCircle className="w-3 h-3 mr-1" /> Resolvido
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {alert.due_date ? new Date(alert.due_date).toLocaleDateString("pt-PT") : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(alert.created_at).toLocaleDateString("pt-PT")}
                </TableCell>
                <TableCell>
                  {alert.status === 'pending' && (
                    <Button variant="ghost" size="sm" onClick={() => resolveAlert(alert.id)}>
                      Resolver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum alerta encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
