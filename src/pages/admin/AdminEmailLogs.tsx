import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Search, CheckCircle, XCircle, Clock, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  shop_id: string;
  created_at: string;
  shop_name?: string;
}

export default function AdminEmailLogs() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [shopFilter, setShopFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const load = async () => {
      const [logsRes, shopsRes] = await Promise.all([
        supabase.from("email_logs").select("*").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
        supabase.from("shops").select("id, name"),
      ]);
      const shopMap = new Map((shopsRes.data || []).map(s => [s.id, s.name]));
      setShops(shopsRes.data || []);
      setLogs((logsRes.data || []).map(l => ({ ...l, shop_name: shopMap.get(l.shop_id) || "—" })));
      setLoading(false);
    };
    load();
  }, [page]);

  const filtered = logs.filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (shopFilter !== "all" && l.shop_id !== shopFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.to_email.toLowerCase().includes(q) || l.subject.toLowerCase().includes(q);
    }
    return true;
  });

  const statusIcon = (status: string) => {
    if (status === "sent") return <CheckCircle className="w-4 h-4 text-success" />;
    if (status === "failed") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-warning" />;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      sent: "bg-success/10 text-success border-success/30",
      failed: "bg-destructive/10 text-destructive border-destructive/30",
      pending: "bg-warning/10 text-warning border-warning/30",
    };
    return (
      <Badge variant="outline" className={`text-xs ${variants[status] || ""}`}>
        {statusIcon(status)}
        <span className="ml-1">{status === "sent" ? "Enviado" : status === "failed" ? "Falhado" : "Pendente"}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 w-full bg-muted/30 animate-pulse rounded" />
        <div className="stat-card h-64 animate-pulse bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" /> {t('admin.emailLogs.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.emailLogs.subtitle')} · {logs.length} {t('admin.emailLogs.records')}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('admin.emailLogs.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder={t('admin.emailLogs.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.emailLogs.allStatus')}</SelectItem>
            <SelectItem value="sent">{t('admin.emailLogs.sent')}</SelectItem>
            <SelectItem value="failed">{t('admin.emailLogs.failed')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={shopFilter} onValueChange={setShopFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder={t('admin.emailLogs.shop')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.emailLogs.allShops')}</SelectItem>
            {shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name || "—"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('admin.emailLogs.status')}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('admin.emailLogs.recipient')}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">{t('admin.emailLogs.subject')}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">{t('admin.emailLogs.shop')}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">{t('admin.emailLogs.type')}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('admin.emailLogs.date')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">{t('admin.emailLogs.noEmails')}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">{statusBadge(log.status)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{log.to_email}</span>
                      {log.error_message && <p className="text-xs text-destructive mt-0.5 truncate max-w-[200px]">{log.error_message}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-[250px]">{log.subject}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{log.shop_name}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {log.entity_type && <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs mono">
                      {new Date(log.created_at).toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>{t('admin.emailLogs.previous')}</Button>
          <span className="text-xs text-muted-foreground">{t('admin.emailLogs.page')} {page + 1}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={filtered.length < PAGE_SIZE}>{t('admin.emailLogs.next')}</Button>
        </div>
      </div>
    </div>
  );
}
