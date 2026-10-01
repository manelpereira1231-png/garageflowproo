import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface PartApplication {
  id: string; part_id: string; shop_id: string;
  make: string | null; model: string | null; engine: string | null; version: string | null;
  year_from: number | null; year_to: number | null; oem_reference: string | null;
  part_brand: string | null; engine_code: string | null; vin: string | null; notes: string | null;
  mileage_km?: number | null;
}

const empty = { make: "", model: "", engine: "", version: "", year_from: "", year_to: "", oem_reference: "", part_brand: "", engine_code: "", vin: "", notes: "", mileage_km: "" };
const db = supabase as any;

export function describeApplication(a: PartApplication) {
  const years = a.year_from || a.year_to ? `${a.year_from ?? "…"}–${a.year_to ?? "…"}` : "";
  return [a.make, a.model, a.version, a.engine, a.engine_code, years].filter(Boolean).join(" · ") || "Aplicação sem viatura";
}

export function PartApplicationsDialog({ part, shopId, canEdit, open, onOpenChange, onChanged }: {
  part: { id: string; name: string } | null; shopId: string | null; canEdit: boolean;
  open: boolean; onOpenChange: (o: boolean) => void; onChanged?: () => void;
}) {
  const [rows, setRows] = useState<PartApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<{ make: string; model: string }[]>([]);

  const makes = [...new Set(catalog.map(c => c.make))].sort((a, b) => a.localeCompare(b, "pt"));
  const makeKey = form.make.trim().toLowerCase();
  const models = [...new Set(catalog.filter(c => c.make.toLowerCase() === makeKey).map(c => c.model))].sort((a, b) => a.localeCompare(b, "pt"));
  const versions = [...new Set(rows.filter(r => r.make?.toLowerCase() === makeKey && (!form.model || r.model?.toLowerCase() === form.model.trim().toLowerCase())).map(r => r.version).filter(Boolean) as string[])].sort();

  const load = async () => {
    if (!part) return;
    setLoading(true);
    const { data, error } = await db.from("part_applications").select("*").eq("part_id", part.id).order("make");
    if (error) toast.error(error.message);
    setRows((data as PartApplication[]) || []);
    setLoading(false);
  };
  useEffect(() => { if (open) { load(); setForm(empty); setEditId(null); } /* eslint-disable-next-line */ }, [open, part?.id]);
  useEffect(() => {
    if (!open) return;
    db.from("vehicle_catalog").select("make, model").order("make").order("model").limit(5000)
      .then(({ data }: any) => setCatalog(data || []));
    /* eslint-disable-next-line */
  }, [open]);

  const save = async () => {
    if (!part || !shopId) return;
    const t = (v: string) => v.trim() || null;
    const n = (v: string) => (v.trim() ? Number(v) : null);
    const payload = {
      make: t(form.make), model: t(form.model), engine: t(form.engine), version: t(form.version),
      year_from: n(form.year_from), year_to: n(form.year_to), oem_reference: t(form.oem_reference),
      part_brand: t(form.part_brand), engine_code: t(form.engine_code), vin: t(form.vin), notes: t(form.notes), mileage_km: n(form.mileage_km.replace(/\D/g, "")),
    };
    if (!payload.make && !payload.model && !payload.engine_code && !payload.vin && !payload.oem_reference) {
      toast.error("Indique pelo menos marca, modelo, código de motor, VIN ou referência."); return;
    }
    setSaving(true);
    const res = editId
      ? await db.from("part_applications").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editId)
      : await db.from("part_applications").insert({ ...payload, part_id: part.id, shop_id: shopId });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editId ? "Compatibilidade atualizada" : "Compatibilidade adicionada");
    setForm(empty); setEditId(null); load(); onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta compatibilidade?")) return;
    const { error } = await db.from("part_applications").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load(); onChanged?.();
  };

  const edit = (a: PartApplication) => {
    setEditId(a.id);
    setForm({
      make: a.make ?? "", model: a.model ?? "", engine: a.engine ?? "", version: a.version ?? "",
      year_from: a.year_from?.toString() ?? "", year_to: a.year_to?.toString() ?? "", oem_reference: a.oem_reference ?? "",
      part_brand: a.part_brand ?? "", engine_code: a.engine_code ?? "", vin: a.vin ?? "", notes: a.notes ?? "", mileage_km: a.mileage_km?.toString() ?? "",
    });
  };

  const f = (k: keyof typeof empty, label: string, numeric = false) => (
    <div><Label className="text-xs">{label}</Label>
      <Input className="h-11" inputMode={numeric ? "numeric" : undefined} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Viaturas compatíveis — {part?.name}</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há compatibilidades registadas para esta peça.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(a => (
              <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0 text-sm space-y-1">
                  <div className="break-words"><span className="font-bold uppercase">{a.make}</span> <span className="uppercase">{[a.model, a.version].filter(Boolean).join(" ")}</span>
                    {(a.year_from || a.year_to) && <span className="text-muted-foreground"> [{a.year_from ?? "…"}-{a.year_to ?? "…"}]</span>}
                    {!a.make && !a.model && <span className="text-muted-foreground">Sem viatura</span>}
                  </div>
                  <dl className="grid grid-cols-[auto,1fr] gap-x-3 text-xs">
                    {a.oem_reference && <><dt className="font-semibold">Referência</dt><dd className="break-all">{a.oem_reference}</dd></>}
                    {a.vin && <><dt className="font-semibold">Nº Chassis</dt><dd className="break-all font-mono">{a.vin}</dd></>}
                    {a.engine_code && <><dt className="font-semibold">Código do Motor</dt><dd>{a.engine_code}</dd></>}
                    {a.mileage_km != null && <><dt className="font-semibold">Quilómetros</dt><dd>{a.mileage_km.toLocaleString("pt-PT")} km</dd></>}
                    {(a.part_brand || a.engine || a.notes) && <><dt className="font-semibold">Outros</dt><dd className="break-words">{[a.engine, a.part_brand && `Marca peça: ${a.part_brand}`, a.notes].filter(Boolean).join(" · ")}</dd></>}
                  </dl>
                </div>
                {canEdit && <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => edit(a)} aria-label="Editar"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => remove(a.id)} aria-label="Remover"><Trash2 className="w-4 h-4" /></Button>
                </div>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-semibold">{editId ? "Editar compatibilidade" : "Adicionar compatibilidade"}</p>
            <p className="text-xs font-semibold text-muted-foreground">Detalhes do Veículo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {f("make", "Marca (ex.: Land Rover)")}{f("model", "Modelo (ex.: Range Rover Sport II (L494))")}
              {f("version", "Versão / motorização (ex.: 3.0 SDV6 4x4, 5 portas)")}
              <div className="grid grid-cols-2 gap-3">{f("year_from", "Ano de", true)}{f("year_to", "Ano até", true)}</div>
              {f("oem_reference", "Referência")}{f("vin", "Nº Chassis")}
              {f("engine_code", "Código do Motor")}{f("mileage_km", "Quilómetros", true)}
            </div>
            <details className="rounded-lg border border-border p-3">
              <summary className="text-sm cursor-pointer min-h-[44px] flex items-center">Mais campos (opcional)</summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {f("engine", "Motor")}{f("part_brand", "Marca da peça")}
              </div>
              <div className="mt-3">{f("notes", "Observações")}</div>
            </details>
            <div className="flex gap-2 justify-end">
              {editId && <Button variant="outline" className="h-11" onClick={() => { setEditId(null); setForm(empty); }}>Cancelar</Button>}
              <Button className="h-11" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}{editId ? "Guardar" : "Adicionar"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
