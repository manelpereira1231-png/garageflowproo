import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileText, CheckCircle, Clock, AlertTriangle, FileDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportToCsv } from "@/lib/pdfGenerator";
import { toast } from "sonner";

export default function FinancialReports() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalRevenue: 0, totalVat: 0, invoiceCount: 0,
    paidCount: 0, overdueCount: 0, monthlyData: [] as any[],
  });
  const [currency, setCurrency] = useState("€");

  useEffect(() => {
    const load = async () => {
      const shopId = localStorage.getItem("garageflow_active_shop");
      if (!shopId) return;

      const { data: shop } = await supabase.from("shops").select("currency").eq("id", shopId).maybeSingle();
      if (shop) setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("shop_id", shopId)
        .neq("status", "cancelled");

      if (!invoices) return;

      const today = new Date().toISOString().slice(0, 10);
      const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0);
      const totalVat = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.vat_total), 0);
      const paidCount = invoices.filter(i => i.status === 'paid').length;
      const overdueCount = invoices.filter(i => ['issued', 'partial'].includes(i.status) && i.due_date && i.due_date < today).length;

      // Monthly aggregation (last 6 months)
      const months: Record<string, { revenue: number; count: number; vat: number }> = {};
      for (let m = 5; m >= 0; m--) {
        const d = new Date();
        d.setMonth(d.getMonth() - m);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { revenue: 0, count: 0, vat: 0 };
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

      setStats({
        totalRevenue, totalVat, invoiceCount: invoices.length,
        paidCount, overdueCount,
        monthlyData: Object.entries(months).map(([month, data]) => ({ month, ...data })),
      });
    };
    load();
  }, []);

  const handleExport = () => {
    exportToCsv(stats.monthlyData.map(m => ({
      Mês: m.month,
      'Receita Paga': m.revenue.toFixed(2),
      'IVA': m.vat.toFixed(2),
      'Faturas': m.count,
    })), 'relatorio-financeiro');
    toast.success(t('common.exported'));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('financial.reports')}</h1>
          <p className="text-muted-foreground text-sm">{t('financial.reportsDescription')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileDown className="w-4 h-4 mr-1" />CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><TrendingUp className="w-5 h-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{t('financial.totalRevenue')}</p>
                <p className="text-xl font-bold">{currency}{stats.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{t('financial.totalInvoices')}</p>
                <p className="text-xl font-bold">{stats.invoiceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="w-5 h-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{t('financial.paidInvoices')}</p>
                <p className="text-xl font-bold">{stats.paidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{t('financial.overdueInvoices')}</p>
                <p className="text-xl font-bold">{stats.overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10"><Clock className="w-5 h-5 text-info" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{t('financial.totalVat')}</p>
                <p className="text-xl font-bold">{currency}{stats.totalVat.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
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
