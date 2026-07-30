import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertTriangle, XCircle, ShieldCheck, Phone, Mail, Car } from "lucide-react";

type Item = {
  name: string;
  key: string;
  category: string;
  status: "ok" | "attention" | "repair" | "na";
  notes?: string;
  photoUrl?: string;
};

type PublicInspection = {
  id: string;
  items: Item[] | string;
  technician: string | null;
  completed_at: string | null;
  created_at: string;
  shop: { name: string; phone?: string; email?: string; address?: string; logo_url?: string };
  vehicle: { make: string; model: string; plate: string; year?: number } | null;
  work_order_number: string | null;
};

const STATUS_META = {
  ok: { label: "Conforme", icon: CheckCircle, cls: "bg-green-100 text-green-800 border-green-300" },
  attention: { label: "A vigiar", icon: AlertTriangle, cls: "bg-amber-100 text-amber-800 border-amber-300" },
  repair: { label: "Requer reparação", icon: XCircle, cls: "bg-red-100 text-red-800 border-red-300" },
  na: { label: "Não verificado", icon: ShieldCheck, cls: "bg-muted text-muted-foreground border-border" },
} as const;

export default function PublicInspection() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicInspection | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data: res } = await supabase.rpc("get_public_inspection", { _token: token });
      if (!active) return;
      setData((res as unknown as PublicInspection) ?? null);
      setLoading(false);
      if (res) await supabase.rpc("mark_public_inspection_viewed", { _token: token });
    })();
    return () => { active = false; };
  }, [token]);

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
            <h1 className="text-lg font-semibold">Inspeção indisponível</h1>
            <p className="text-sm text-muted-foreground">
              Este link expirou ou já não está partilhado. Contacte a oficina para receber um novo link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items: Item[] = Array.isArray(data.items)
    ? data.items
    : (() => { try { return JSON.parse(String(data.items)) as Item[]; } catch { return []; } })();

  const checked = items.filter(i => i.status !== "na");
  const repairs = items.filter(i => i.status === "repair");
  const attention = items.filter(i => i.status === "attention");
  const overall = repairs.length > 0
    ? { label: "Reparações necessárias", cls: STATUS_META.repair.cls }
    : attention.length > 0
      ? { label: "Pontos a vigiar", cls: STATUS_META.attention.cls }
      : { label: "Veículo conforme", cls: STATUS_META.ok.cls };

  const categories = Array.from(new Set(items.map(i => i.category)));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          {data.shop.logo_url && (
            <img src={data.shop.logo_url} alt={`Logótipo de ${data.shop.name}`} className="h-10 w-10 rounded object-contain" />
          )}
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{data.shop.name}</h1>
            <p className="text-xs text-muted-foreground">Relatório de inspeção do seu veículo</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">
                  {data.vehicle ? `${data.vehicle.make} ${data.vehicle.model} · ${data.vehicle.plate}` : "Veículo"}
                </span>
              </div>
              <Badge variant="outline" className={overall.cls}>{overall.label}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border p-2">
                <div className="text-lg font-semibold">{checked.length}/{items.length}</div>
                <div className="text-[11px] text-muted-foreground">Pontos verificados</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-lg font-semibold text-amber-600">{attention.length}</div>
                <div className="text-[11px] text-muted-foreground">A vigiar</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-lg font-semibold text-red-600">{repairs.length}</div>
                <div className="text-[11px] text-muted-foreground">A reparar</div>
              </div>
            </div>
            {data.technician && (
              <p className="text-xs text-muted-foreground">Técnico responsável: {data.technician}</p>
            )}
          </CardContent>
        </Card>

        {categories.map(cat => (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{cat}</h2>
            <div className="space-y-2">
              {items.filter(i => i.category === cat).map((item, idx) => {
                const meta = STATUS_META[item.status] ?? STATUS_META.na;
                const Icon = meta.icon;
                return (
                  <Card key={`${item.key}-${idx}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium min-w-0">{item.name}</span>
                        <Badge variant="outline" className={`${meta.cls} shrink-0 gap-1 text-[11px]`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                      </div>
                      {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                      {item.photoUrl && (
                        <img
                          src={item.photoUrl}
                          alt={`Fotografia da inspeção: ${item.name}`}
                          loading="lazy"
                          className="rounded-md border border-border max-h-64 w-full object-cover"
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        <Card>
          <CardContent className="p-4 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-sm">Dúvidas sobre este relatório?</p>
            {data.shop.phone && (
              <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {data.shop.phone}</p>
            )}
            {data.shop.email && (
              <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {data.shop.email}</p>
            )}
            <p className="pt-2">
              Relatório informativo emitido por {data.shop.name}. Não constitui documento fiscal.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
