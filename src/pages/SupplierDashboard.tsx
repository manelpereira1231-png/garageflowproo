import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TrendingUp, Building2, ShoppingCart, Euro } from "lucide-react";
import { format } from "date-fns";

export default function SupplierDashboard() {
  const { language } = useLanguage();
  const isPt = language === "pt";
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: ordersData }, { data: suppData }] = await Promise.all([
      supabase.from("parts_orders").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("suppliers").select("*").order("name"),
    ]);
    setOrders(ordersData || []);
    setSuppliers(suppData || []);
    setLoading(false);
  };

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(o => o.status === "delivered").length;
  const pendingOrders = orders.filter(o => ["pending", "sent"].includes(o.status)).length;

  // Top suppliers by revenue
  const supplierRevenue = new Map<string, { name: string; revenue: number; orders: number }>();
  orders.forEach(o => {
    const sid = o.supplier_id;
    const sName = (o.suppliers as any)?.name || "Unknown";
    if (!supplierRevenue.has(sid)) supplierRevenue.set(sid, { name: sName, revenue: 0, orders: 0 });
    const entry = supplierRevenue.get(sid)!;
    entry.revenue += o.total || 0;
    entry.orders += 1;
  });
  const topSuppliers = [...supplierRevenue.values()].sort((a, b) => b.revenue - a.revenue);

  // Top parts by frequency
  const partFreq = new Map<string, { name: string; count: number; total: number }>();
  orders.forEach(o => {
    const key = o.part_name || "Unknown";
    if (!partFreq.has(key)) partFreq.set(key, { name: key, count: 0, total: 0 });
    const entry = partFreq.get(key)!;
    entry.count += o.quantity || 1;
    entry.total += o.total || 0;
  });
  const topParts = [...partFreq.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  const statusColor = (s: string) => {
    switch (s) {
      case "delivered": return "default";
      case "sent": return "secondary";
      case "pending": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          {isPt ? "Dashboard Fornecedores" : "Supplier Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isPt ? "Visão geral de pedidos, receitas e peças mais vendidas" : "Overview of orders, revenue and top parts"}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ShoppingCart className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">{isPt ? "Total Pedidos" : "Total Orders"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><Euro className="w-5 h-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{isPt ? "Receita Total" : "Total Revenue"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Package className="w-5 h-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold">{pendingOrders}</p>
              <p className="text-xs text-muted-foreground">{isPt ? "Pendentes" : "Pending"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent"><TrendingUp className="w-5 h-5 text-accent-foreground" /></div>
            <div>
              <p className="text-2xl font-bold">{deliveredOrders}</p>
              <p className="text-xs text-muted-foreground">{isPt ? "Entregues" : "Delivered"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{isPt ? "Pedidos" : "Orders"} ({totalOrders})</TabsTrigger>
          <TabsTrigger value="top-suppliers">{isPt ? "Top Fornecedores" : "Top Suppliers"}</TabsTrigger>
          <TabsTrigger value="top-parts">{isPt ? "Peças Mais Vendidas" : "Top Parts"}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isPt ? "Peça" : "Part"}</TableHead>
                    <TableHead>{isPt ? "Fornecedor" : "Supplier"}</TableHead>
                    <TableHead>{isPt ? "Qtd" : "Qty"}</TableHead>
                    <TableHead>{isPt ? "Total" : "Total"}</TableHead>
                    <TableHead>{isPt ? "Estado" : "Status"}</TableHead>
                    <TableHead>{isPt ? "Data" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isPt ? "Nenhum pedido registado" : "No orders registered"}
                      </TableCell>
                    </TableRow>
                  ) : orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.part_name}</TableCell>
                      <TableCell className="text-muted-foreground">{(o.suppliers as any)?.name || "—"}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell className="font-semibold">€{(o.total || 0).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={statusColor(o.status)}>{o.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(o.created_at), "dd/MM/yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-suppliers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isPt ? "Fornecedor" : "Supplier"}</TableHead>
                    <TableHead>{isPt ? "Pedidos" : "Orders"}</TableHead>
                    <TableHead>{isPt ? "Receita" : "Revenue"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSuppliers.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.orders}</TableCell>
                      <TableCell className="font-semibold text-primary">€{s.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-parts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isPt ? "Peça" : "Part"}</TableHead>
                    <TableHead>{isPt ? "Quantidade" : "Quantity"}</TableHead>
                    <TableHead>{isPt ? "Total" : "Total"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topParts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.count}</TableCell>
                      <TableCell className="font-semibold">€{p.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}