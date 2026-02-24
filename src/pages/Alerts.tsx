import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Search, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const alertTypeIcons: Record<string, any> = {
  revision: Clock,
  oil: AlertTriangle,
  inspection: AlertTriangle,
  warranty: AlertTriangle,
  inactive_client: Bell,
  expired_quote: Clock,
};

const alertStatusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success",
  dismissed: "bg-muted text-muted-foreground",
};

export default function Alerts() {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("alerts")
      .select("*, clients(name), vehicles(make, model, plate)")
      .order("created_at", { ascending: false });
    if (data) setAlerts(data);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const resolveAlert = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ status: 'resolved' }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t('alerts.resolved')); fetchAlerts(); }
  };

  const dismissAlert = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ status: 'dismissed' }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchAlerts();
  };

  const filtered = alerts.filter(a => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase()) ||
      (a.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const alertTypes = ['revision', 'oil', 'inspection', 'warranty', 'inactive_client', 'expired_quote'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('alerts.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {alerts.filter(a => a.status === 'pending').length} {t('alerts.pending')}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('alerts.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('alerts.filterType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('alerts.allTypes')}</SelectItem>
            {alertTypes.map(type => (
              <SelectItem key={type} value={type}>{t(`alerts.type.${type}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('alerts.allStatus')}</SelectItem>
            <SelectItem value="pending">{t('alerts.statusPending')}</SelectItem>
            <SelectItem value="resolved">{t('alerts.statusResolved')}</SelectItem>
            <SelectItem value="dismissed">{t('alerts.statusDismissed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('alerts.typeCol')}</TableHead>
              <TableHead>{t('alerts.titleCol')}</TableHead>
              <TableHead>{t('alerts.clientCol')}</TableHead>
              <TableHead>{t('alerts.vehicleCol')}</TableHead>
              <TableHead>{t('alerts.dateCol')}</TableHead>
              <TableHead>{t('alerts.statusCol')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('alerts.empty')}
                </TableCell>
              </TableRow>
            ) : filtered.map(a => {
              const Icon = alertTypeIcons[a.type] || Bell;
              return (
                <TableRow key={a.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs">{t(`alerts.type.${a.type}`)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{(a.clients as any)?.name || '—'}</TableCell>
                  <TableCell>
                    {(a.vehicles as any) ? `${(a.vehicles as any).make} ${(a.vehicles as any).model}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.due_date || new Date(a.created_at).toLocaleDateString('pt-PT')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={alertStatusColors[a.status] || ''}>
                      {t(`alerts.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)} className="text-xs">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          {t('alerts.resolve')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => dismissAlert(a.id)} className="text-xs text-muted-foreground">
                          {t('alerts.dismiss')}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
