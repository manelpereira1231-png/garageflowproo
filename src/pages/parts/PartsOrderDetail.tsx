import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

export default function PartsOrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    if (!orderId) return;
    const [{ data: o }, { data: it }, { data: ev }, { data: sh }] = await Promise.all([
      supabase.from("gsn_orders" as any).select("*, supplier:gsn_suppliers(company_name,trade_name,slug)").eq("id", orderId).maybeSingle(),
      supabase.from("gsn_order_items" as any).select("*, product:gsn_products(title,image)").eq("order_id", orderId),
      supabase.from("gsn_order_events" as any).select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("gsn_carrier_shipments" as any).select("*").eq("order_id", orderId),
    ]);
    setOrder(o); setItems((it as any) ?? []); setEvents((ev as any) ?? []); setShipments((sh as any) ?? []);
  };
  useEffect(() => { void load(); }, [orderId]);

  const openComplaint = async () => {
    const { error } = await supabase.rpc("gsn_complaint_create" as any, { _order_id: orderId, _subject: subject, _body: body });
    if (error) return toast.error(error.message);
    toast.success("Reclamação enviada");
    setComplaintOpen(false); setSubject(""); setBody("");
  };

  if (!order) return <p className="text-sm text-muted-foreground">A carregar...</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encomenda #{order.id.slice(0,8)}</h1>
          <p className="text-sm text-muted-foreground">{order.supplier?.trade_name ?? order.supplier?.company_name} · {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</p>
        </div>
        <Badge>{order.status}</Badge>
      </div>

      <Card><CardHeader><CardTitle>Itens</CardTitle></CardHeader><CardContent className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-2 border rounded-md">
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{i.product?.title ?? "Produto"}</p></div>
            <p className="text-sm">{i.quantity} × {formatMoney(Number(i.unit_price), order.currency)}</p>
            <p className="w-20 text-right font-semibold">{formatMoney(Number(i.total), order.currency)}</p>
          </div>
        ))}
        <div className="pt-2 border-t text-right">
          <p className="text-sm text-muted-foreground">Subtotal {formatMoney(Number(order.subtotal), order.currency)} · {getTaxLabel()} {formatMoney(Number(order.vat_total), order.currency)}</p>
          <p className="text-lg font-bold">Total {formatMoney(Number(order.total), order.currency)}</p>
        </div>
      </CardContent></Card>

      {shipments.length > 0 && (
        <Card><CardHeader><CardTitle>Envio</CardTitle></CardHeader><CardContent className="space-y-2">
          {shipments.map((s) => (
            <div key={s.id} className="text-sm p-2 border rounded-md">
              <p><b>{s.carrier}</b> · {s.status}</p>
              {s.tracking_code && <p>Tracking: {s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{s.tracking_code}</a> : s.tracking_code}</p>}
            </div>
          ))}
        </CardContent></Card>
      )}

      <Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="text-xs flex gap-3">
            <span className="text-muted-foreground w-32">{format(new Date(e.created_at), "dd/MM HH:mm")}</span>
            <span>{e.from_status ? `${e.from_status} → ` : ""}<b>{e.to_status}</b>{e.note ? ` · ${e.note}` : ""}</span>
          </div>
        ))}
      </CardContent></Card>

      <Card><CardContent className="p-4">
        {!complaintOpen ? (
          <Button variant="outline" onClick={() => setComplaintOpen(true)}>Abrir reclamação</Button>
        ) : (
          <div className="space-y-2">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" className="w-full h-9 px-3 border rounded" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Descreva o problema..." rows={4} />
            <div className="flex gap-2"><Button onClick={openComplaint}>Enviar</Button><Button variant="ghost" onClick={() => setComplaintOpen(false)}>Cancelar</Button></div>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
