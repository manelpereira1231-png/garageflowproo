import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", paid: "Pago", confirmed: "Aceite", preparing: "Em preparação",
  shipped: "Enviado", partial: "Parcial", delivered: "Concluído", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default function AdminSupplierDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: s }, { data: p }, { data: o }] = await Promise.all([
      supabase.rpc("gsn_admin_suppliers" as any, { _id: id }).then((r: any) => ({ data: (r.data ?? [])[0] ?? null })),
      supabase.from("gsn_products" as any).select("id,title,sku,price,stock,status,updated_at").eq("supplier_id", id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
      supabase.from("gsn_orders" as any).select("id,order_number,status,total,currency,created_at,buyer_shop_id").eq("supplier_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    setSupplier(s);
    setProducts(((p as any) ?? []));
    setOrders(((o as any) ?? []));

    const ids = (((o as any) ?? []) as any[]).map((r) => r.id);
    if (ids.length) {
      const { data: ev } = await supabase
        .from("gsn_order_events" as any)
        .select("id,order_id,from_status,to_status,note,created_at")
        .in("order_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      setEvents(((ev as any) ?? []));
    } else {
      setEvents([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (values: Record<string, boolean | string>) => {
    const changesApproval = Object.prototype.hasOwnProperty.call(values, "approved");
    let matchingIds = id ? [id] : [];

    if (changesApproval && supplier) {
      const { data: candidates } = await supabase
        .from("gsn_suppliers" as any)
        .select("id,owner_user_id,email")
        .is("deleted_at", null);
      const normalizedEmail = supplier.email?.trim().toLowerCase() ?? null;
      matchingIds = ((candidates as any[]) ?? [])
        .filter((candidate) =>
          candidate.id === id ||
          (!!supplier.owner_user_id && candidate.owner_user_id === supplier.owner_user_id) ||
          (!!normalizedEmail && candidate.email?.trim().toLowerCase() === normalizedEmail)
        )
        .map((candidate) => candidate.id);
    }

    const { error } = await supabase
      .from("gsn_suppliers" as any)
      .update(values)
      .in("id", matchingIds.length > 0 ? matchingIds : id ? [id] : []);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor atualizado");
    void load();
  };

  if (loading) return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  if (!supplier) return <p className="text-sm text-muted-foreground">Fornecedor não encontrado.</p>;

  const published = products.filter((p) => p.status === "active").length;
  const noStock = products.filter((p) => Number(p.stock) === 0).length;
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "paid").length;
  const processing = orders.filter((o) => ["confirmed", "preparing", "shipped", "partial"].includes(o.status)).length;
  const done = orders.filter((o) => o.status === "delivered").length;

  const metrics = [
    { label: "Produtos publicados", value: published },
    { label: "Sem stock", value: noStock },
    { label: "Pedidos pendentes", value: pendingOrders },
    { label: "Em processamento", value: processing },
    { label: "Concluídos", value: done },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/admin/supplier-network" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Rede de Fornecedores
          </Link>
          <h1 className="text-2xl font-bold truncate">{supplier.trade_name || supplier.company_name}</h1>
          <p className="text-sm text-muted-foreground">
            {supplier.email || "—"} · {supplier.phone || "—"} · desde {format(new Date(supplier.created_at), "dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={supplier.approved ? "default" : "secondary"}>{supplier.approved ? "Aprovado" : "Pendente"}</Badge>
          <Badge variant={supplier.active ? "default" : "outline"}>{supplier.active ? "Ativo" : "Inativo"}</Badge>
          {supplier.suspended && <Badge variant="destructive">Suspenso</Badge>}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              patch(
                supplier.approved
                  ? { approved: false, state: "pending_approval" }
                  : { approved: true, active: true, state: "approved", approved_at: new Date().toISOString() }
              )
            }
          >
            {supplier.approved ? "Remover aprovação" : "Aprovar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => patch({ active: !supplier.active })}>
            {supplier.active ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <Card>
            <CardHeader><CardTitle className="text-base">{products.length} produtos</CardTitle></CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Este fornecedor ainda não publicou produtos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2">Referência</th>
                        <th className="px-3 py-2 text-right">Preço</th>
                        <th className="px-3 py-2 text-right">Stock</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">{p.title}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.sku || "—"}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(Number(p.price))}</td>
                          <td className="px-3 py-2 text-right">{p.stock}</td>
                          <td className="px-3 py-2"><Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle className="text-base">{orders.length} pedidos</CardTitle></CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
                  <p className="text-sm">Ainda não existem pedidos.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">{o.order_number ?? `#${o.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{formatMoney(Number(o.total), o.currency)}</p>
                        <Badge variant="outline">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas alterações</CardTitle></CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem atividade registada.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div key={e.id} className="text-sm border rounded-md p-3">
                      <p>
                        {(STATUS_LABEL[e.from_status] ?? e.from_status ?? "Criada")} → <strong>{STATUS_LABEL[e.to_status] ?? e.to_status}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}{e.note ? ` · ${e.note}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
