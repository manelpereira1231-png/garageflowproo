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
import { useLanguage } from "@/i18n/LanguageContext";

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, any>;
}

const ACTION_KEYS: Record<string, string> = {
  shop_created: 'admin.logs.shopCreated',
  shop_suspended: 'admin.logs.shopSuspended',
  shop_activated: 'admin.logs.shopActivated',
  shop_deleted: 'admin.logs.shopDeleted',
  plan_changed: 'admin.logs.planChanged',
  trial_reset: 'admin.logs.trialReset',
  role_changed: 'admin.logs.roleChanged',
  alerts_reset: 'admin.logs.alertsReset',
  subscription_cancelled: 'admin.logs.subscriptionCancelled',
  user_removed: 'admin.logs.userRemoved',
  user_invited: 'admin.logs.userInvited',
  settings_updated: 'admin.logs.settingsUpdated',
};

export default function AdminLogs() {
  const { t } = useLanguage();
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

  const getActionLabel = (action: string) => ACTION_KEYS[action] ? t(ACTION_KEYS[action]) : action;

  const filtered = logs.filter(log => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (search) {
      const s = search.toLowerCase();
      const label = getActionLabel(log.action).toLowerCase();
      const details = JSON.stringify(log.details).toLowerCase();
      if (!label.includes(s) && !details.includes(s) && !log.entity_type.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = [t('admin.logs.date'), t('admin.logs.action'), t('admin.logs.entity'), t('admin.logs.details')];
    const rows = filtered.map(log => [
      new Date(log.created_at).toLocaleString("pt-PT"),
      getActionLabel(log.action),
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
        {getActionLabel(action)}
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
          <h1 className="page-title">{t('admin.logs.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.logs.subtitle')}</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          {t('admin.logs.exportCSV')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('admin.logs.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('admin.logs.action')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.logs.allActions')}</SelectItem>
            {Object.entries(ACTION_KEYS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{t(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.logs.date')}</TableHead>
              <TableHead>{t('admin.logs.action')}</TableHead>
              <TableHead>{t('admin.logs.entity')}</TableHead>
              <TableHead>{t('admin.logs.details')}</TableHead>
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
                  {t('admin.logs.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}