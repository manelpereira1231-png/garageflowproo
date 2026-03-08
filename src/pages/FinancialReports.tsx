import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileText, CheckCircle, Clock, AlertTriangle, FileDown, Users, Wrench, Lock } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportToCsv } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useSubscription } from "@/hooks/useSubscription";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--info))"];

export default function FinancialReports() {
  const { canUseFeature, plan } = useSubscription();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalRevenue: 0, totalVat: 0, invoiceCount: 0,
    paidCount: 0, overdueCount: 0, avgTicket: 0,
    monthlyData: [] as any[],
    topServices: [] as any[],
    topClients: [] as any[],
    conversionRate: 0,
  });
  const [currency, setCurrency] = useState("€");

  useEffect(() => {
    const load = async () => {
      const shopId = localStorage.getItem("garageflow_active_shop");
      if (!shopId) return;

      const { data: shop } = await supabase.from("shops").select("currency").eq("id", shopId).maybeSingle();
      if (shop) setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);

      const [invoicesRes, workOrdersRes, quotesRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("shop_id", shopId).neq("status", "cancelled"),
        supabase.from("work_orders").select("*, clients(name)").eq("shop_id", shopId),
        supabase.from("quotes").select("id, status").eq("shop_id", shopId),
      ]);

      const invoices = invoicesRes.data || [];
      const workOrders = workOrdersRes.data || [];
      const quotes = quotesRes.data || [];

      const today = new Date().toISOString().slice(0, 10);
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.total), 0);
      const totalVat = paidInvoices.reduce((s, i) => s + Number(i.vat_total), 0);
      const paidCount = paidInvoices.length;
      const overdueCount = invoices.filter(i => ['issued', 'partial'].includes(i.status) && i.due_date && i.due_date < today).length;
      const avgTicket = paidCount > 0 ? totalRevenue / paidCount : 0;

      // Conversion rate
      const totalQuotes = quotes.length;
      const approvedQuotes = quotes.filter(q => ['approved', 'converted'].includes(q.status)).length;
      const conversionRate = totalQuotes > 0 ? (approvedQuotes / totalQuotes) * 100 : 0;

      // Monthly aggregation (last 12 months)
      const months: Record<string, { revenue: number; count: number; vat: number; profit: number }> = {};
      for (let m = 11; m >= 0; m--) {
        const d = new Date();
        d.setMonth(d.getMonth() - m);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { revenue: 0, count: 0, vat: 0, profit: 0 };
      }
      invoices.forEach(inv => {
        const key = inv.created_at.slice(0, 7);
        if (months[key]) {
          months[key].count++;
          if (inv.status === 'paid') {
            months[key].revenue += Number(inv.total);
            months[key].vat += Number(inv.vat_total);
          }
        }
      });

      // Top services by revenue
      const serviceRevenue: Record<string, number> = {};
      workOrders.forEach(wo => {
        const lines = Array.isArray(wo.lines) ? wo.lines : [];
        (lines as any[]).forEach((line: any) => {
          const name = line.description || 'Outro';
          serviceRevenue[name] = (serviceRevenue[name] || 0) + Number(line.total || 0);
        });
      });
      const topServices = Object.entries(serviceRevenue)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value: Number(value.toFixed(2)) }));

      // Top clients by revenue
      const clientRevenue: Record<string, { name: string; total: number; count: number }> = {};
      workOrders.forEach(wo => {
        const clientName = (wo.clients as any)?.name || 'Desconhecido';
        if (!clientRevenue[clientName]) clientRevenue[clientName] = { name: clientName, total: 0, count: 0 };
        clientRevenue[clientName].total += Number(wo.total || 0);
        clientRevenue[clientName].count++;
      });
      const topClients = Object.values(clientRevenue)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setStats({
        totalRevenue, totalVat, invoiceCount: invoices.length,
        paidCount, overdueCount, avgTicket, conversionRate,
        monthlyData: Object.entries(months).map(([month, data]) => ({ month: month.slice(5), ...data })),
        topServices, topClients,
      });
    };
    load();
  }, []);

  const handleExport = () => {
    if (!canUseFeature('csvExport')) {
      toast.error(t('planGate.description').replace('{plan}', 'Pro'));
      return;
    }
    exportToCsv(stats.monthlyData.map(m => ({
      Mês: m.month, 'Receita Paga': m.revenue.toFixed(2),
      'IVA': m.vat.toFixed(2), 'Faturas': m.count,
    })), 'relatorio-financeiro');
    toast.success(t('common.exported'));
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('financial.reports')}</h1>
          <p className="text-muted-foreground text-sm">{t('financial.reportsDescription')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!canUseFeature('csvExport')}>
          {canUseFeature('csvExport') ? <FileDown className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
          CSV {!canUseFeature('csvExport') && <span className="text-xs ml-1">(Pro+)</span>}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('financial.totalRevenue'), value: `${currency}${stats.totalRevenue.toFixed(0)}`, icon: TrendingUp, color: "text-success" },
          { label: t('financial.totalInvoices'), value: stats.invoiceCount, icon: FileText, color: "text-primary" },
          { label: t('financial.paidInvoices'), value: stats.paidCount, icon: CheckCircle, color: "text-success" },
          { label: t('financial.overdueInvoices'), value: stats.overdueCount, icon: AlertTriangle, color: "text-destructive" },
          { label: t('financial.avgTicket'), value: `${currency}${stats.avgTicket.toFixed(0)}`, icon: Clock, color: "text-info" },
          { label: t('financial.conversionRate'), value: `${stats.conversionRate.toFixed(0)}%`, icon: TrendingUp, color: "text-primary" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('financial.monthlyRevenue')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${currency}${v.toFixed(2)}`, '']}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Invoices trend */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('financial.invoicesTrend')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top services & clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4" />{t('financial.topServices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('common.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.topServices} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                    {stats.topServices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${currency}${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />{t('financial.topClients')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('common.noData')}</p>
            ) : (
              <div className="space-y-3">
                {stats.topClients.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <span className="text-sm font-medium truncate max-w-[140px]">{c.name}</span>
                      <span className="text-xs text-muted-foreground">({c.count} serv.)</span>
                    </div>
                    <span className="text-sm font-bold text-success">{currency}{c.total.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown table */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('financial.monthlyBreakdown')}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('financial.month')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('financial.invoicesIssued')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('financial.revenuePaid')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">IVA</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyData.map(m => (
                  <tr key={m.month} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{m.month}</td>
                    <td className="py-2 px-3 text-right">{m.count}</td>
                    <td className="py-2 px-3 text-right mono font-medium text-success">{currency}{m.revenue.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right mono">{currency}{m.vat.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
