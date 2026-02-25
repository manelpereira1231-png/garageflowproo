import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Users, Car, FileText, Wrench, DollarSign, TrendingUp, AlertTriangle, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface ShopDetail {
  id: string; name: string; email: string; phone: string; country: string;
  currency: string; timezone: string; status: string; created_at: string;
  logo_url: string | null; vat_rate: number; labor_rate: number;
  nif: string | null; address: string | null;
}

export default function AdminShopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [plan, setPlan] = useState("free");
  const [stats, setStats] = useState({ clients: 0, vehicles: 0, quotes: 0, workOrders: 0, revenue: 0, avgTicket: 0, pendingAlerts: 0 });
  const [monthlyData, setMonthlyData] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", nif: "", address: "", vat_rate: "23", labor_rate: "35" });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    const [shopRes, subRes, clientsRes, vehiclesRes, quotesRes, woRes, alertsRes, logsRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single(),
      supabase.from("subscriptions").select("plan").eq("shop_id", id).single(),
      supabase.from("clients").select("id").eq("shop_id", id),
      supabase.from("vehicles").select("id").eq("shop_id", id),
      supabase.from("quotes").select("id").eq("shop_id", id),
      supabase.from("work_orders").select("id, total, status, created_at").eq("shop_id", id),
      supabase.from("alerts").select("id, status").eq("shop_id", id).eq("status", "pending"),
      supabase.from("audit_logs").select("*").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
    ]);

    if (shopRes.data) setShop(shopRes.data as ShopDetail);
    setPlan(subRes.data?.plan || "free");

    const completed = (woRes.data || []).filter(wo => wo.status === 'completed' || wo.status === 'delivered');
    const revenue = completed.reduce((s, wo) => s + Number(wo.total || 0), 0);

    setStats({
      clients: clientsRes.data?.length || 0,
      vehicles: vehiclesRes.data?.length || 0,
      quotes: quotesRes.data?.length || 0,
      workOrders: woRes.data?.length || 0,
      revenue,
      avgTicket: completed.length > 0 ? revenue / completed.length : 0,
      pendingAlerts: alertsRes.data?.length || 0,
    });

    const now = new Date();
    const md: { month: string; revenue: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString("pt-PT", { month: "short" });
      const monthOrders = (woRes.data || []).filter(wo => {
        const woDate = new Date(wo.created_at);
        return woDate.getMonth() === d.getMonth() && woDate.getFullYear() === d.getFullYear();
      });
      const monthRevenue = monthOrders.filter(wo => wo.status === 'completed' || wo.status === 'delivered')
        .reduce((s, wo) => s + Number(wo.total || 0), 0);
      md.push({ month: monthStr, revenue: Math.round(monthRevenue), orders: monthOrders.length });
    }
    setMonthlyData(md);
    setRecentLogs(logsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const openEditDialog = () => {
    if (!shop) return;
    setEditForm({
      name: shop.name || "", email: shop.email || "", phone: shop.phone || "",
      nif: shop.nif || "", address: shop.address || "",
      vat_rate: String(shop.vat_rate), labor_rate: String(shop.labor_rate),
    });
    setEditOpen(true);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({
      name: editForm.name, email: editForm.email, phone: editForm.phone,
      nif: editForm.nif || null, address: editForm.address || null,
      vat_rate: parseFloat(editForm.vat_rate), labor_rate: parseFloat(editForm.labor_rate),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Oficina atualizada"); setEditOpen(false); fetchAll(); }
    setSaving(false);
  };

  if (loading || !shop) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const planColor = plan === 'garage' ? 'text-success' : plan === 'pro' ? 'text-primary' : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/admin/shops")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar às oficinas
      </Button>

      {/* Header */}
      <div className="stat-card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{shop.name || "Sem nome"}</h1>
            <p className="text-sm text-muted-foreground">{shop.email} · {shop.phone}</p>
            <p className="text-sm text-muted-foreground">{shop.country} · {shop.currency} · {shop.timezone}</p>
            {shop.nif && <p className="text-sm text-muted-foreground">NIF: {shop.nif}</p>}
            {shop.address && <p className="text-sm text-muted-foreground">{shop.address}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
            </Button>
            <Badge variant="outline" className={shop.status === 'active' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}>
              {shop.status === 'active' ? 'Ativa' : 'Suspensa'}
            </Badge>
            <Badge variant="outline" className={`${planColor}`}>{plan.toUpperCase()}</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Clientes", value: stats.clients, icon: Users },
          { label: "Veículos", value: stats.vehicles, icon: Car },
          { label: "Orçamentos", value: stats.quotes, icon: FileText },
          { label: "Serviços", value: stats.workOrders, icon: Wrench },
          { label: "Faturação", value: `€${stats.revenue.toFixed(0)}`, icon: DollarSign },
          { label: "Ticket Médio", value: `€${stats.avgTicket.toFixed(0)}`, icon: TrendingUp },
          { label: "Alertas", value: stats.pendingAlerts, icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <s.icon className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold mono">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-4">Faturação vs Serviços (6 meses)</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Faturação (€)" />
              <Bar dataKey="orders" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Serviços" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Histórico de Ações</h2>
          <div className="space-y-2">
            {recentLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.entity_type}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-PT")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Shop Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Oficina</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveShop} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome *</Label>
                <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>NIF</Label>
                <Input value={editForm.nif} onChange={e => setEditForm({...editForm, nif: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Morada</Label>
                <Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa IVA (%)</Label>
                <Input type="number" step="0.01" value={editForm.vat_rate} onChange={e => setEditForm({...editForm, vat_rate: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa Mão de Obra (€/h)</Label>
                <Input type="number" step="0.01" value={editForm.labor_rate} onChange={e => setEditForm({...editForm, labor_rate: e.target.value})} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "A guardar..." : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
