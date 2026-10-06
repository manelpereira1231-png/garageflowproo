import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, CheckCircle2, Circle } from "lucide-react";
import { clientMessageForPhase } from "@/lib/claimPhases";

/** Página pública de acompanhamento do sinistro (sem login). */
export default function ClaimTrack() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("claim-share", { body: { token, action: "view" } }).then(({ data, error }) => {
      if (error || !data || data.error || data.audience !== "cliente") setErr(true); else setD(data);
    });
  }, [token]);

  if (err) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-muted-foreground">Este link já não está disponível. Contacte a oficina.</div>;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">A carregar…</div>;

  const isBR = d.shop.country === "BR";
  const loc = isBR ? "pt-BR" : "pt-PT";
  const money = (v: number) => new Intl.NumberFormat(loc, { style: "currency", currency: d.shop.currency || (isBR ? "BRL" : "EUR") }).format(v || 0);
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(loc, { day: "2-digit", month: "2-digit" }) : "");
  const now = d.message || clientMessageForPhase(d.phase === "perda_total" ? "decisao" : d.phase, isBR, d.pendingSup);
  const car = isBR ? "veículo" : "viatura";
  const tl = (d.timeline || []).map((t: any) => ({ ...t, label: isBR ? t.label.replace("Viatura recebida", "Veículo recebido").replace("Pronto para levantar", "Pronto para retirar") : t.label }));

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-foreground text-background px-5 pt-6 pb-8">
        <p className="text-sm opacity-80">{d.shop.name}</p>
        <h1 className="text-2xl font-bold mt-1">{isBR ? "O seu" : "O seu"} {[d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || car}</h1>
        {d.vehicle?.plate && <p className="font-mono mt-1 opacity-90">{d.vehicle.plate}</p>}
      </header>
      <main className="max-w-lg mx-auto px-4 -mt-4 space-y-4 pb-10">
        <section className="rounded-[14px] border border-amber-500 bg-amber-500/10 p-4">
          <p className="text-xs font-bold tracking-wider text-amber-700 dark:text-amber-400">AGORA</p>
          <p className="mt-1 font-medium">{now}</p>
        </section>
        <section className="rounded-[14px] border border-border bg-card p-4">
          <ol className="space-y-4">
            {tl.map((t: any) => (
              <li key={t.key} className="flex gap-3">
                {t.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div>
                  <p className={t.done ? "font-medium" : "text-muted-foreground"}>{t.label}</p>
                  {t.date && <p className="text-xs text-muted-foreground">{t.expected && !t.done ? "Previsto " : ""}{fmt(t.date)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
        {d.clientShare && d.clientShare.total > 0 && (
          <section className="rounded-[14px] border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">A seu cargo</p>
            <p className="text-2xl font-bold">{money(d.clientShare.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Franquia da apólice {money(d.clientShare.franchise)}{d.clientShare.extras > 0 ? ` + trabalhos não cobertos pela seguradora ${money(d.clientShare.extras)}` : ""}. O restante é pago pela seguradora.
            </p>
          </section>
        )}
        {d.shop.phone && (
          <Button asChild className="w-full min-h-[52px] text-base">
            <a href={`tel:${String(d.shop.phone).replace(/\s/g, "")}`}><Phone className="h-5 w-5 mr-2" />Ligar para a oficina</a>
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">via GarageFlow</p>
      </main>
    </div>
  );
}
