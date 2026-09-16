import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, ShoppingCart, AlertTriangle, TrendingUp, Star, Boxes, Inbox,
  CheckCircle2, ArrowRight, Store, Network, Sparkles, Activity, PackageCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { formatMoney } from "@/lib/money";
import { format } from "date-fns";

interface Stats {
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  ordersNew: number;
  ordersProcessing: number;
  ordersDone: number;
  lowStock: number;
  published: number;
  inStock: number;
  outOfStock: number;
  totalProducts: number;
  ratingAverage: number;
}

interface RecentOrder {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  currency: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  label: string;
  at: string;
  to: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", paid: "Pago", confirmed: "Aceite", preparing: "Em preparação",
  shipped: "Enviado", partial: "Parcial", delivered: "Concluído", cancelled: "Cancelado", refunded: "Reembolsado",
};

const COUNTED = ["paid", "confirmed", "preparing", "shipped", "partial", "delivered"];

const initial: Stats = {
  revenueToday: 0, revenueMonth: 0, revenueYear: 0, ordersNew: 0, ordersProcessing: 0, ordersDone: 0,
  lowStock: 0, published: 0, inStock: 0, outOfStock: 0, totalProducts: 0, ratingAverage: 0,
};

const PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "company_name", label: "Razão social" },
  { key: "vat_number", label: "NIF" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "address", label: "Morada" },
  { key: "city", label: "Cidade" },
  { key: "description", label: "Descrição" },
  { key: "logo_url", label: "Logótipo" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 13) return "Bom dia";
  if (h < 20) return "Boa tarde";
  return "Boa noite";
}

export default function SupplierDashboard() {
  const { supplierId, state } = useIsSupplier();
  const [stats, setStats] = useState<Stats>(initial);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [network, setNetwork] = useState<{ shops: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    const now = new Date();
    const startYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const [
      { count: published }, { count: out }, { count: low }, { count: total },
      { data: supplierRows }, { data: yearOrders }, { data: recentRows },
      { data: moves }, { data: platform },
    ] = await Promise.all([
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("status", "active").is("deleted_at", null),
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("stock", 0).is("deleted_at", null),
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).lte("stock", 5).gt("stock", 0).is("deleted_at", null),
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).is("deleted_at", null),
      supabase.rpc("gsn_my_supplier" as any),
      supabase.from("gsn_orders" as any).select("status,total,created_at").eq("supplier_id", supplierId).gte("created_at", startYear),
      supabase.from("gsn_orders" as any).select("id,order_number,status,total,currency,created_at").eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(8),
      supabase.from("gsn_stock_movements" as any).select("id,quantity,type,created_at,product:gsn_products(title)").eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(5),
      supabase.rpc("get_public_platform_stats" as any),
    ]);

    const own = (((supplierRows as any) ?? []) as any[]).find((s) => s.id === supplierId) ?? null;
    setProfile(own);

    const rows = ((yearOrders as any) ?? []) as { status: string; total: number; created_at: string }[];
    const todayKey = now.toDateString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let revenueToday = 0, revenueMonth = 0, revenueYear = 0, ordersNew = 0, ordersProcessing = 0, ordersDone = 0;
    for (const r of rows) {
      const d = new Date(r.created_at);
      if (COUNTED.includes(r.status)) {
        const v = Number(r.total) || 0;
        revenueYear += v;
        if (d.getTime() >= monthStart) revenueMonth += v;
        if (d.toDateString() === todayKey) revenueToday += v;
      }
      if (r.status === "pending" || r.status === "paid") ordersNew++;
      if (r.status === "confirmed" || r.status === "preparing" || r.status === "shipped" || r.status === "partial") ordersProcessing++;
      if (r.status === "delivered") ordersDone++;
    }

    const totalProducts = total ?? 0;
    const outOfStock = out ?? 0;

    setStats({
      revenueToday, revenueMonth, revenueYear, ordersNew, ordersProcessing, ordersDone,
      lowStock: low ?? 0,
      published: published ?? 0,
      inStock: Math.max(0, totalProducts - outOfStock),
      outOfStock,
      totalProducts,
      ratingAverage: Number(own?.rating_average ?? 0),
    });

    const recentOrders = ((recentRows as any) ?? []) as RecentOrder[];
    setRecent(recentOrders);

    const acts: ActivityItem[] = [
      ...recentOrders.slice(0, 4).map((o) => ({
        id: `order-${o.id}`,
        label: `Pedido ${o.order_number ?? `#${o.id.slice(0, 8)}`} · ${STATUS_LABEL[o.status] ?? o.status}`,
        at: o.created_at,
        to: "/supplier/orders",
      })),
      ...(((moves as any) ?? []) as any[]).map((m) => ({
        id: `move-${m.id}`,
        label: `Stock atualizado em "${m.product?.title ?? "produto"}" (${m.quantity > 0 ? "+" : ""}${m.quantity})`,
        at: m.created_at,
        to: "/supplier/stock",
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
    setActivity(acts);

    const p: any = platform;
    if (p && typeof p.shops === "number") setNetwork({ shops: p.shops });

    setLoading(false);
  }, [supplierId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!supplierId) return;
    const channel = supabase
      .channel(`gsn-dash-${supplierId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gsn_orders", filter: `supplier_id=eq.${supplierId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supplierId, load]);

  const missing = useMemo(
    () => (profile ? PROFILE_FIELDS.filter((f) => !String(profile[f.key] ?? "").trim()) : []),
    [profile],
  );
  const profilePct = profile
    ? Math.round(((PROFILE_FIELDS.length - missing.length) / PROFILE_FIELDS.length) * 100)
    : 0;

  const displayName = profile?.trade_name || profile?.company_name || "";

  const nextAction = useMemo(() => {
    if (missing.length > 0) return { label: "Completar dados da empresa", to: "/supplier/profile" };
    if (stats.totalProducts === 0) return { label: "Publicar primeiro produto", to: "/supplier/products/new" };
    if (stats.published === 0) return { label: "Publicar catálogo", to: "/supplier/products?f=draft" };
    return { label: "Gerir catálogo", to: "/supplier/products" };
  }, [missing.length, stats.totalProducts, stats.published]);

  const cards = [
    { label: "Produtos publicados", value: stats.published, icon: Package, to: "/supplier/products?f=published" },
    { label: "Produtos em stock", value: stats.inStock, icon: PackageCheck, to: "/supplier/products" },
    { label: "Sem stock", value: stats.outOfStock, icon: Boxes, to: "/supplier/products?f=out" },
    { label: "Pedidos novos", value: stats.ordersNew, icon: ShoppingCart, to: "/supplier/orders?f=new" },
    { label: "Em processamento", value: stats.ordersProcessing, icon: Activity, to: "/supplier/orders?f=processing" },
    { label: "Pedidos concluídos", value: stats.ordersDone, icon: CheckCircle2, to: "/supplier/orders?f=done" },
    { label: "Receita mês", value: formatMoney(stats.revenueMonth), icon: TrendingUp, to: "/supplier/payments" },
    { label: "Receita ano", value: formatMoney(stats.revenueYear), icon: TrendingUp, to: "/supplier/payments" },
    { label: "Avaliação média", value: stats.ratingAverage.toFixed(1), icon: Star, to: "/supplier/reviews" },
  ];

  const steps = [
    { n: 1, title: "Publique os seus produtos", text: "Adicione referências, preços e stock." },
    { n: 2, title: "As oficinas encontram os seus produtos", text: "Os produtos publicados ficam disponíveis na Rede GarageFlow." },
    { n: 3, title: "Receba pedidos", text: "Quando uma oficina tiver interesse, o pedido aparece no seu painel." },
    { n: 4, title: "Gira tudo num só lugar", text: "Acompanhe pedidos, stock e catálogo diretamente no GarageFlow." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {greeting()}{displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerir produtos, stock e pedidos e chegar a oficinas através da rede GarageFlow.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={state === "approved" ? "default" : "outline"} className="gap-1">
            <span className={state === "approved" ? "text-emerald-400" : ""}>●</span>
            {state === "approved" ? "Fornecedor ativo na Rede" : state === "suspended" || state === "blocked" ? "Conta suspensa" : "Conta pendente de aprovação"}
          </Badge>
        </div>
      </div>

      {/* Próxima ação útil */}
      <Card className="border-primary/30">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold">
              {stats.totalProducts === 0 ? "Ainda não tem produtos publicados?" : "Próximo passo recomendado"}
            </p>
            <p className="text-sm text-muted-foreground">
              {stats.totalProducts === 0
                ? "Adicione o primeiro produto para começar a ser encontrado pelas oficinas."
                : "Mantenha o catálogo, o stock e os preços atualizados para as oficinas da rede."}
            </p>
          </div>
          <Link to={nextAction.to} className="shrink-0">
            <Button>{nextAction.label}<ArrowRight className="w-4 h-4 ml-2" /></Button>
          </Link>
        </CardContent>
      </Card>

      {/* Alerta de stock */}
      {stats.outOfStock > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold">Atenção ao stock</p>
                <p className="text-sm text-muted-foreground">
                  Existem {stats.outOfStock} produto{stats.outOfStock === 1 ? "" : "s"} sem stock.
                  {stats.lowStock > 0 ? ` ${stats.lowStock} com stock baixo.` : ""}
                </p>
              </div>
            </div>
            <Link to="/supplier/products?f=out" className="shrink-0">
              <Button variant="outline">Ver produtos</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <c.icon className="w-4 h-4 text-primary shrink-0" />
                </div>
                {loading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold">{c.value}</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfil */}
        <Card>
          <CardHeader><CardTitle className="text-base">Complete o seu perfil</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading || !profile ? (
              <Skeleton className="h-16 w-full" />
            ) : missing.length === 0 ? (
              <p className="text-sm text-emerald-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Perfil completo
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Perfil {profilePct}% completo</span>
                  <Link to="/supplier/profile" className="text-primary hover:underline">Editar perfil</Link>
                </div>
                <Progress value={profilePct} />
                <p className="text-xs text-muted-foreground">
                  Em falta: {missing.map((m) => m.label).join(", ")}.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Rede */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Network className="w-4 h-4 text-primary" />Rede GarageFlow</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold">{network ? network.shops : "—"}</p>
                <p className="text-xs text-muted-foreground">Oficinas na rede</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-xs text-muted-foreground">Produtos publicados</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ordersNew + stats.ordersProcessing + stats.ordersDone}</p>
                <p className="text-xs text-muted-foreground">Pedidos recebidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primeiros passos para fornecedores novos */}
      {stats.totalProducts === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Comece em 3 passos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              "Complete os dados da empresa.",
              "Adicione os seus produtos.",
              "Publique o catálogo e comece a receber pedidos.",
            ].map((t, i) => (
              <div key={t} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm">{t}</p>
              </div>
            ))}
            <Link to={nextAction.to}><Button size="sm">Começar agora</Button></Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos pedidos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos pedidos</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-sm">Ainda não recebeu pedidos. Publique produtos para ser encontrado pelas oficinas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((o) => (
                  <Link key={o.id} to={`/supplier/orders?o=${o.id}`} className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-accent/40">
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium truncate">{o.order_number ?? `#${o.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{formatMoney(Number(o.total), o.currency)}</p>
                      <Badge variant="outline">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividade recente */}
        <Card>
          <CardHeader><CardTitle className="text-base">Atividade recente</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem atividade registada.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <Link key={a.id} to={a.to} className="flex items-center justify-between gap-3 p-2.5 border rounded-md hover:bg-accent/40">
                    <span className="text-sm min-w-0 truncate">{a.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(a.at), "dd/MM HH:mm")}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Como funciona */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Chegue a mais oficinas através do GarageFlow</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="p-3 border rounded-md">
              <p className="text-xs text-primary font-semibold mb-1">{s.n}</p>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Institucional */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Store className="w-4 h-4 text-primary" />O GarageFlow liga oficinas e fornecedores</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O GarageFlow é uma plataforma de gestão criada para oficinas automóvel. A Rede de Fornecedores permite que as
            oficinas encontrem produtos e fornecedores dentro do mesmo ecossistema.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ["Mais visibilidade", "Os seus produtos podem ser encontrados por oficinas que utilizam o GarageFlow."],
              ["Gestão centralizada", "Catálogo, preços, stock e pedidos num único painel."],
              ["Ligação direta às oficinas", "Receba e acompanhe pedidos através do GarageFlow."],
              ["Menos trabalho manual", "Centralize informação e reduza processos dispersos."],
            ].map(([t, d]) => (
              <div key={t} className="p-3 border rounded-md">
                <p className="text-sm font-medium">{t}</p>
                <p className="text-xs text-muted-foreground mt-1">{d}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Porque integrar a sua empresa no GarageFlow?</p>
            <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
              <li>Presença dentro de uma plataforma dedicada ao setor oficinal.</li>
              <li>Catálogo digital e gestão de stock.</li>
              <li>Exposição junto das oficinas da rede.</li>
              <li>Receção e gestão de pedidos num só lugar.</li>
              <li>Evolução futura da integração entre oficinas e fornecedores.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
