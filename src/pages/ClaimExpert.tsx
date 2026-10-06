import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

const toB64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] || "");
  r.onerror = rej; r.readAsDataURL(f);
});

/** Página pública do perito para validar um adicional (sem login). */
export default function ClaimExpert() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = () => supabase.functions.invoke("claim-share", { body: { token, action: "view" } }).then(({ data, error }) => {
    if (error || !data || data.error || data.audience !== "perito") { setErr(true); return; }
    setD(data); setAmount(String(data.supplement.amount_requested ?? ""));
  });
  useEffect(() => { load(); }, [token]);

  if (err) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-muted-foreground">Este link já não está disponível. Contacte a oficina.</div>;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">A carregar…</div>;

  const isBR = d.shop.country === "BR";
  const loc = isBR ? "pt-BR" : "pt-PT";
  const money = (v: number) => new Intl.NumberFormat(loc, { style: "currency", currency: d.shop.currency || (isBR ? "BRL" : "EUR") }).format(v || 0);
  const s = d.supplement;
  const decided = !["pending", "no_perito"].includes(s.status);
  const title = s.type === "inicial" ? "Orçamento inicial" : `Adicional #${s.number}`;
  const lineTotal = (d.lines || []).reduce((t: number, l: any) => t + l.quantity * l.unit_price, 0);

  const send = async (decision: "approve" | "more_photos" | "reject") => {
    if (decision === "approve" && (!Number.isFinite(Number(amount)) || !(Number(amount) > 0) || Number(amount) > Number(s.amount_requested))) { toast.error("Indique o valor que valida."); return; }
    if (file && file.size > 10 * 1024 * 1024) { toast.error("O relatório tem de ter menos de 10 MB."); return; }
    setBusy(true);
    const report = file ? { name: file.name, type: file.type || "application/pdf", base64: await toB64(file) } : undefined;
    const { data, error } = await supabase.functions.invoke("claim-share", { body: { token, action: "decide", decision, amount: Number(amount), notes, report } });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error === "already_decided" ? "Este pedido já foi decidido." : "Não foi possível registar a decisão."); return; }
    setDone(decision === "approve" ? `${s.type === "inicial" ? "Orçamento inicial" : "Adicional"} validado. Decisão registada para a oficina.` : decision === "reject" ? "Decisão registada: não validado." : "Pedido de mais fotografias registado para a oficina.");
  };

  return (
    <div className="claims-surface min-h-screen bg-muted/40">
      <header className="bg-foreground text-background px-5 py-5">
        <p className="text-sm opacity-80">Pedido enviado por {d.shop.name} · via GarageFlow</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">{title} · {d.ref || "Sinistro"}{d.insurer ? ` · ${d.insurer}` : ""}</h1>
      </header>
      <main className="max-w-5xl mx-auto p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 min-w-0">
          <section className="rounded-[14px] border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Matrícula</p><p className="font-mono font-semibold">{d.vehicle?.plate || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Marca e modelo</p><p className="font-medium break-words">{[d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Peritagem inicial</p><p className="font-medium">{d.expertDate ? new Date(d.expertDate).toLocaleDateString(loc) : "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Já autorizado</p><p className="font-medium">{money(d.authorized || 0)}</p></div>
            {d.vehicle?.version && <div><p className="text-xs text-muted-foreground">Versão</p><p className="font-medium break-words">{d.vehicle.version}</p></div>}
            {d.vehicle?.year && <div><p className="text-xs text-muted-foreground">Ano</p><p>{d.vehicle.year}</p></div>}
            {d.vehicle?.vin && <div className="col-span-2"><p className="text-xs text-muted-foreground">VIN / Chassis</p><p className="font-mono break-all">{d.vehicle.vin}</p></div>}
            {d.vehicle?.mileage != null && <div><p className="text-xs text-muted-foreground">Quilómetros</p><p>{Number(d.vehicle.mileage).toLocaleString(loc)} km</p></div>}
            {d.processNumber && <div><p className="text-xs text-muted-foreground">Nº do processo</p><p className="break-words">{d.processNumber}</p></div>}
          </section>
          <section className="rounded-[14px] border border-border bg-card p-4">
            <p className="font-semibold">{s.description}</p>
            <p className="text-sm text-muted-foreground">Valor pedido: {money(s.amount_requested)}</p>
            {s.notes && <p className="text-sm mt-1">{s.notes}</p>}
          </section>
          <section className="rounded-[14px] border border-border bg-card p-4">
            <p className="font-semibold mb-2">Fotografias dos danos</p>
            {d.photos?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {d.photos.map((u: string) => <Button variant="ghost" className="h-auto p-0" aria-label="Ver fotografia dos danos" key={u} type="button" onClick={() => setZoom(u)}><img src={u} alt="Dano" className="aspect-[4/3] w-full rounded-md object-cover" loading="lazy" /></Button>)}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem fotografias anexadas.</p>}
          </section>
          {d.lines?.length > 0 && (
            <section className="rounded-[14px] border border-border bg-card p-4 text-sm">
              <p className="font-semibold mb-2">Linhas do orçamento</p>
              {d.lines.map((l: any, i: number) => (
                <div key={i} className="flex justify-between gap-2 border-t border-border py-1.5"><span>{l.quantity} × {l.name}</span><span>{money(l.quantity * l.unit_price)}</span></div>
              ))}
              <div className="flex justify-between font-semibold border-t-2 border-border pt-1.5"><span>Total</span><span>{money(lineTotal)}</span></div>
            </section>
          )}
        </div>
        <aside className="rounded-[14px] border border-border bg-card p-4 space-y-3 h-fit">
          <p className="font-semibold">A sua decisão</p>
          {done || decided ? (
            <p className="text-sm">{done || `Este pedido já foi decidido${s.amount_approved != null ? ` (${money(Number(s.amount_approved))})` : ""}.`}</p>
          ) : (
            <>
              <div><Label>Valor que valida</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>Observações</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div><Label>Relatório (PDF ou foto, opcional)</Label><Input type="file" accept="application/pdf,image/*" className="min-h-[44px]" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
              <Button className="w-full min-h-[44px] claim-tone-success" disabled={busy} onClick={() => send("approve")}>{s.type === "inicial" ? "Validar orçamento inicial" : "Validar adicional"}</Button>
              <Button variant="outline" className="w-full min-h-[44px]" disabled={busy} onClick={() => send("more_photos")}>Pedir mais fotografias</Button>
              <Button variant="outline" className="w-full min-h-[44px] border-destructive text-destructive" disabled={busy} onClick={() => send("reject")}>Não validar</Button>
            </>
          )}
        </aside>
      </main>
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="claims-surface max-w-5xl w-[96vw]">{zoom && <img src={zoom} alt="Dano" className="w-full max-h-[85vh] object-contain" />}</DialogContent>
      </Dialog>
    </div>
  );
}
