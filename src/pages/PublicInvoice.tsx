import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, CreditCard, FileText, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

type Item = { description: string; quantity: number; unit_price: number; vat_rate: number };
type PublicInvoice = {
  id: string;
  number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  paid_online_at: string | null;
  provider_pdf_url: string | null;
  client_name: string | null;
  shop: {
    name: string; phone?: string; email?: string; address?: string;
    logo_url?: string; currency?: string; country_code?: string; online_payments: boolean;
  };
  items: Item[];
};

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [data, setData] = useState<PublicInvoice | null>(null);

  const money = (v: number) =>
    new Intl.NumberFormat(data?.shop.country_code === "BR" ? "pt-BR" : "pt-PT", {
      style: "currency",
      currency: data?.shop.currency || "EUR",
    }).format(Number(v || 0));

  const load = async () => {
    if (!token) { setLoading(false); return; }
    const { data: res } = await supabase.rpc("get_public_invoice", { _token: token });
    setData((res as unknown as PublicInvoice) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const sessionId = params.get("session_id");
      if (token && sessionId) {
        // Confirmação server-side do pagamento (nunca confiar no redirect).
        const { data: res } = await supabase.functions.invoke("invoice-pay", {
          body: { token, action: "confirm", session_id: sessionId },
        });
        if ((res as any)?.paid) toast.success("Pagamento confirmado. Obrigado!");
      }
      if (params.get("canceled")) toast.info("Pagamento cancelado.");
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handlePay = async () => {
    if (!token) return;
    setPaying(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("invoice-pay", {
        body: { token, action: "checkout", origin: window.location.origin },
      });
      if (error) throw new Error("Não foi possível iniciar o pagamento.");
      if ((res as any)?.error) throw new Error((res as any).error);
      const url = (res as any)?.url;
      if (!url) throw new Error("Pagamento indisponível de momento.");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar o pagamento");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <h1 className="text-lg font-semibold">Fatura indisponível</h1>
            <p className="text-sm text-muted-foreground">
              Este link já não está ativo. Contacte a oficina para receber um novo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = !!data.paid_online_at || data.status === "paid";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          {data.shop.logo_url && (
            <img src={data.shop.logo_url} alt={`Logótipo de ${data.shop.name}`} className="h-10 w-10 rounded object-contain" />
          )}
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{data.shop.name}</h1>
            <p className="text-xs text-muted-foreground">Fatura {data.number}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total a pagar</p>
                <p className="text-2xl font-bold">{money(data.total)}</p>
              </div>
              <Badge variant="outline" className={isPaid ? "bg-green-100 text-green-800 border-green-300" : ""}>
                {isPaid ? "Pago" : "Por pagar"}
              </Badge>
            </div>
            {data.client_name && <p className="text-xs text-muted-foreground">Cliente: {data.client_name}</p>}
            {data.due_date && (
              <p className="text-xs text-muted-foreground">
                Vencimento: {new Date(data.due_date).toLocaleDateString("pt-PT")}
              </p>
            )}

            {isPaid ? (
              <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4" /> Pagamento recebido. Obrigado!
              </div>
            ) : data.shop.online_payments ? (
              <Button className="w-full h-11" onClick={handlePay} disabled={paying}>
                {paying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Pagar agora
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Esta oficina recebe o pagamento diretamente. Contacte-a para combinar o método.
              </p>
            )}

            {!isPaid && data.shop.online_payments && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                Pagamento processado de forma segura pela plataforma GarageFlow em nome da oficina.
              </p>
            )}

            {data.provider_pdf_url && (
              <a
                href={data.provider_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline"
              >
                <FileText className="w-3 h-3" /> Descarregar fatura em PDF
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="text-sm font-semibold">Detalhe</h2>
            <ul className="divide-y divide-border">
              {data.items.map((it, i) => (
                <li key={i} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    {it.description}
                    <span className="block text-xs text-muted-foreground">
                      {it.quantity} × {money(it.unit_price)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{money(it.quantity * it.unit_price)}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{money(data.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Impostos</span><span>{money(data.tax)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span><span>{money(data.total)}</span>
              </div>
            </div>
            {data.notes && <p className="text-xs text-muted-foreground pt-2">{data.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p className="text-sm font-medium text-foreground">{data.shop.name}</p>
            {data.shop.address && <p>{data.shop.address}</p>}
            {data.shop.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{data.shop.phone}</p>}
            {data.shop.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{data.shop.email}</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
