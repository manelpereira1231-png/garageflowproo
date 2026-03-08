import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, FileText, CheckCircle, Clock, AlertTriangle, FileDown, Users, Wrench, Lock, Receipt, Percent, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportToCsv } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { useSubscription } from "@/hooks/useSubscription";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#ec4899"];

export default function FinancialReports() {
  const { canUseFeature, plan } = useSubscription();
  const { t } = useLanguage();
  const [period, setPeriod] = useState("12");
  const [stats, setStats] = useState({
    totalRevenue: 0, totalVat: 0, invoiceCount: 0,
    paidCount: 0, overdueCount: 0, avgTicket: 0,
    monthlyData: [] as any[],
    topServices: [] as any[],
    topClients: [] as any[],
    conversionRate: 0,
    totalProfit: 0,
    profitMargin: 0,
    pendingAmount: 0,
    revenueGrowth: 0,
    paymentMethods: [] as any[],
  });
  const [currency, setCurrency] = useState("€");

  useEffect(() => {
    const load = async () => {
      const shopId = localStorage.getItem("garageflow_active_shop");
      if (!shopId) return;

      const { data: shop } = await supabase.from("shops").select("currency").eq("id", shopId).maybeSingle();
      if (shop) setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);

      const monthCount = parseInt(period);

      const [invoicesRes, workOrdersRes, quotesRes, paymentsRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("shop_id", shopId).neq("status", "cancelled"),
        supabase.from("work_orders").select("*, clients(name)").eq("shop_id", shopId),
        supabase.from("quotes").select("id, status").eq("shop_id", shopId),
        supabase.from("payments").select("*").eq("shop_id", shopId),
      ]);

      const invoices = invoicesRes.data || [];
      const workOrders = workOrdersRes.data || [];
      const quotes = quotesRes.data || [];
      const payments = paymentsRes.data || [];

      const today = new Date().toISOString().slice(0, 10);
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.total), 0);
      const totalVat = paidInvoices.reduce((s, i) => s + Number(i.vat_total), 0);
      const paidCount = paidInvoices.length;
      const overdueCount = invoices.filter(i => ['issued', 'partial'].includes(i.status) && i.due_date && i.due_date < today).length;
      const avgTicket = paidCount > 0 ? totalRevenue / paidCount : 0;
      const pendingAmount = invoices.filter(i => ['issued', 'partial', 'draft'].includes(i.status)).reduce((s, i) => s + Number(i.total), 0);

      // Profit from work orders
      const totalProfit = workOrders.reduce((s, wo) => s + Number(wo.profit || 0), 0);
      const totalWORevenue = workOrders.reduce((s, wo) => s + Number(wo.total || 0), 0);
      const profitMargin = totalWORevenue > 0 ? (totalProfit / totalWORevenue) * 100 : 0;

      // Conversion rate
      const totalQuotes = quotes.length;
      const approvedQuotes = quotes.filter(q => ['approved', 'converted'].includes(q.status)).length;
      const conversionRate = totalQuotes > 0 ? (approvedQuotes / totalQuotes) * 100 : 0;

      // Monthly aggregation
      const months: Record<string, { revenue: number; count: number; vat: number; profit: number }> = {};
      for (let m = monthCount - 1; m >= 0; m--) {
        const d = new Date(); d.setMonth(d.getMonth() - m);
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
      workOrders.forEach(wo => {
        const key = wo.created_at.slice(0, 7);
        if (months[key]) months[key].profit += Number(wo.profit || 0);
      });

      // Revenue growth (current vs previous month)
      const monthKeys = Object.keys(months);
      const currentMonth = months[monthKeys[monthKeys.length - 1]]?.revenue || 0;
      const prevMonth = months[monthKeys[monthKeys.length - 2]]?.revenue || 0;
      const revenueGrowth = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;

      // Top services
      const serviceRevenue: Record<string, number> = {};
      workOrders.forEach(wo => {
        const lines = Array.isArray(wo.lines) ? wo.lines : [];
        (lines as any[]).forEach((line: any) => {
          const name = line.description || 'Outro';
          serviceRevenue[name] = (serviceRevenue[name] || 0) + Number(line.total || 0);
        });
      });
      const topServices = Object.entries(serviceRevenue)
        .sort(([, a], [, b]) => b - a).slice(0, 6)
        .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, value: Number(value.toFixed(2)) }));

      // Top clients
      const clientRevenue: Record<string, { name: string; total: number; count: number }> = {};
      workOrders.forEach(wo => {
        const clientName = (wo.clients as any)?.name || 'Desconhecido';
        if (!clientRevenue[clientName]) clientRevenue[clientName] = { name: clientName, total: 0, count: 0 };
        clientRevenue[clientName].total += Number(wo.total || 0);
        clientRevenue[clientName].count++;
      });
      const topClients = Object.values(clientRevenue).sort((a, b) => b.total - a.total).slice(0, 5);

      // Payment methods breakdown
      const methodMap: Record<string, number> = {};
      payments.forEach(p => {
        const m = p.method || 'cash';
        methodMap[m] = (methodMap[m] || 0) + Number(p.amount);
      });
      const paymentMethods = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

      setStats({
        totalRevenue, totalVat, invoiceCount: invoices.length,
        paidCount, overdueCount, avgTicket, conversionRate,
        totalProfit, profitMargin, pendingAmount, revenueGrowth,
        monthlyData: Object.entries(months).map(([month, data]) => ({ month: month.slice(5), ...data })),
        topServices, topClients, paymentMethods,
      });
    };
    load();
  }, [period]);

  const handleExport = () => {
    if (!canUseFeature('csvExport')) {
      toast.error(t('planGate.description').replace('{plan}', 'Pro'));
      return;
    }
    exportToCsv(stats.monthlyData.map(m => ({
      Mês: m.month, 'Receita Paga': m.revenue.toFixed(2),
      'IVA': m.vat.toFixed(2), 'Lucro': m.profit.toFixed(2), 'Faturas': m.count,
    })), 'relatorio-financeiro');
    toast.success(t('common.exported'));
  };

  const GrowthBadge = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <Badge variant="outline" className={`text-[10px] gap-0.5 ${isPositive ? 'text-green-600 border-green-300 bg-green-50' : 'text-red-600 border-red-300 bg-red-50'}`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(value).toFixed(0)}%
      </Badge>
    );
  };

  if (!canUseFeature('basicReports')) {
    return (
      <div>
        <div className="page-header">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />{t('financial.reports')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">{t('financial.reports')}</h3>
          <p className="text-muted-foreground mb-4">{t('financial.disabledPlan')}</p>
          <Link to="/billing"><Button>{t('nav.billing')}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            {t('financial.reports')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('financial.reportsDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">{t('financial.last3m')}</SelectItem>
              <SelectItem value="6">{t('financial.last6m')}</SelectItem>
              <SelectItem value="12">{t('financial.last12m')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!canUseFeature('csvExport')}>
            {canUseFeature('csvExport') ? <FileDown className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
            CSV
          </Button>
        </div>
      </div>

      {/* KPIs - 2 rows */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('financial.totalRevenue'), value: `${currency}${stats.totalRevenue.toFixed(0)}`, icon: DollarSign, color: "text-green-500", growth: stats.revenueGrowth },
          { label: t('financial.totalProfit'), value: `${currency}${stats.totalProfit.toFixed(0)}`, icon: TrendingUp, color: "text-primary" },
          { label: t('financial.profitMargin'), value: `${stats.profitMargin.toFixed(1)}%`, icon: Percent, color: "text-blue-500" },
          { label: t('financial.avgTicket'), value: `${currency}${stats.avgTicket.toFixed(0)}`, icon: Receipt, color: "text-purple-500" },
          { label: t('financial.paidInvoices'), value: stats.paidCount, icon: CheckCircle, color: "text-green-500" },
          { label: t('financial.overdueInvoices'), value: stats.overdueCount, icon: AlertTriangle, color: "text-destructive" },
          { label: t('financial.pendingAmount'), value: `${currency}${stats.pendingAmount.toFixed(0)}`, icon: Clock, color: "text-yellow-500" },
          { label: t('financial.conversionRate'), value: `${stats.conversionRate.toFixed(0)}%`, icon: TrendingUp, color: "text-primary" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-3 pb-2 px-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
                </div>
                {'growth' in kpi && kpi.growth !== undefined && <GrowthBadge value={kpi.growth as number} />}
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue + Profit Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('financial.revenueVsProfit')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.monthlyData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${currency}${v.toFixed(0)}`} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} name={t('financial.revenue')} />
                <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#profGrad)" strokeWidth={2} name={t('financial.profit')} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('financial.invoicesTrend')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t('financial.totalInvoices')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top services, clients, payment methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <Pie data={stats.topServices} cx="50%" cy="50%" outerRadius={75} innerRadius={40} dataKey="value" label={({ name }) => name}>
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
                      <div>
                        <span className="text-sm font-medium truncate max-w-[120px] block">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">{c.count} {t('financial.services')}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-600">{currency}{c.total.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Receipt className="w-4 h-4" />{t('financial.paymentMethods')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('common.noData')}</p>
            ) : (
              <div className="space-y-3">
                {stats.paymentMethods.map((pm, i) => {
                  const total = stats.paymentMethods.reduce((s, p) => s + p.value, 0);
                  const pct = total > 0 ? (pm.value / total) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{pm.name}</span>
                        <span className="text-sm text-muted-foreground">{currency}{pm.value.toFixed(0)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
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
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('financial.profit')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">IVA</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyData.map(m => (
                  <tr key={m.month} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{m.month}</td>
                    <td className="py-2 px-3 text-right">{m.count}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-600">{currency}{m.revenue.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-medium text-primary">{currency}{m.profit.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{currency}{m.vat.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-2 px-3">Total</td>
                  <td className="py-2 px-3 text-right">{stats.monthlyData.reduce((s, m) => s + m.count, 0)}</td>
                  <td className="py-2 px-3 text-right text-green-600">{currency}{stats.monthlyData.reduce((s, m) => s + m.revenue, 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-primary">{currency}{stats.monthlyData.reduce((s, m) => s + m.profit, 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{currency}{stats.monthlyData.reduce((s, m) => s + m.vat, 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
