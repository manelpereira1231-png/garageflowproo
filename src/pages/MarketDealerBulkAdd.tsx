import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MarketLayout from "@/components/MarketLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Building2, ArrowLeft, AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

const FUEL_OPTIONS = ["Gasóleo", "Gasolina", "Híbrido", "Elétrico", "GPL"];

type Row = {
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuel: string;
  plate: string;
  vin: string;
  price: number;
};

const emptyRow = (): Row => ({
  make: "",
  model: "",
  year: new Date().getFullYear(),
  mileage: 0,
  fuel: "Gasóleo",
  plate: "",
  vin: "",
  price: 0,
});

export default function MarketDealerBulkAdd() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/market/auth?account=dealer");
        return;
      }
      const { data: prof } = await supabase
        .from("carity_seller_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof || prof.account_type !== "dealer") {
        toast.error("Acesso restrito a Stands.");
        navigate("/market/dashboard");
        return;
      }
      setProfile(prof);
      setLoading(false);
    })();
  }, [navigate]);

  const update = (idx: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (idx: number) => setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== idx) : r));

  const validRows = rows.filter((r) => r.make && r.model && r.plate && r.price > 0);

  const submit = async () => {
    if (validRows.length === 0) {
      toast.error("Preenche pelo menos uma linha (marca, modelo, matrícula, preço).");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    let ok = 0;
    let fail = 0;
    const failures: string[] = [];

    for (const r of validRows) {
      const { error } = await supabase.from("carity_listings").insert({
        seller_id: user.id,
        make: r.make,
        model: r.model,
        year: r.year,
        mileage: r.mileage,
        fuel: r.fuel,
        plate: r.plate.toUpperCase(),
        vin: r.vin || null,
        price: r.price,
        photos: [],
        status: "pending_payment",
      } as any);
      if (error) {
        fail++;
        failures.push(`${r.plate}: ${error.message}`);
      } else {
        ok++;
      }
    }

    setSaving(false);
    if (ok > 0) toast.success(`${ok} viatura(s) criada(s) como rascunho. Adiciona fotos e paga inspeção em cada uma.`);
    if (fail > 0) toast.error(`${fail} falha(s): ${failures.slice(0, 2).join(" · ")}`);
    if (ok > 0 && fail === 0) navigate("/market/dealer-dashboard");
  };

  if (loading) {
    return (
      <MarketLayout>
        <div className="container max-w-6xl mx-auto p-6 text-slate-400">A carregar…</div>
      </MarketLayout>
    );
  }

  return (
    <MarketLayout>
      <div className="container max-w-6xl mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white">
              <Link to="/market/dealer-dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao painel</Link>
            </Button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Bulk listing</p>
              <h1 className="text-xl font-bold text-white">Adicionar várias viaturas de uma vez</h1>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Carrega aqui os dados base. Cada viatura fica como <span className="text-amber-400 font-semibold">rascunho</span> — depois adicionas fotos e pagas a inspeção independente em cada uma para publicar.
          </p>
        </div>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 sm:p-5 space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                <div className="col-span-12 sm:col-span-2">
                  <Label className="text-[11px] text-slate-400">Marca *</Label>
                  <Input value={row.make} onChange={(e) => update(idx, { make: e.target.value })} className="h-9 bg-slate-900 border-slate-700 text-white" placeholder="BMW" />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <Label className="text-[11px] text-slate-400">Modelo *</Label>
                  <Input value={row.model} onChange={(e) => update(idx, { model: e.target.value })} className="h-9 bg-slate-900 border-slate-700 text-white" placeholder="320d" />
                </div>
                <div className="col-span-6 sm:col-span-1">
                  <Label className="text-[11px] text-slate-400">Ano</Label>
                  <Input type="number" value={row.year} onChange={(e) => update(idx, { year: Number(e.target.value) })} className="h-9 bg-slate-900 border-slate-700 text-white" />
                </div>
                <div className="col-span-6 sm:col-span-1">
                  <Label className="text-[11px] text-slate-400">KM</Label>
                  <Input type="number" value={row.mileage} onChange={(e) => update(idx, { mileage: Number(e.target.value) })} className="h-9 bg-slate-900 border-slate-700 text-white" />
                </div>
                <div className="col-span-6 sm:col-span-1">
                  <Label className="text-[11px] text-slate-400">Combust.</Label>
                  <Select value={row.fuel} onValueChange={(v) => update(idx, { fuel: v })}>
                    <SelectTrigger className="h-9 bg-slate-900 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{FUEL_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label className="text-[11px] text-slate-400">Matrícula *</Label>
                  <Input value={row.plate} onChange={(e) => update(idx, { plate: e.target.value })} className="h-9 bg-slate-900 border-slate-700 text-white uppercase" placeholder="00-AB-00" />
                </div>
                <div className="col-span-8 sm:col-span-2">
                  <Label className="text-[11px] text-slate-400">Preço €*</Label>
                  <Input type="number" value={row.price} onChange={(e) => update(idx, { price: Number(e.target.value) })} className="h-9 bg-slate-900 border-slate-700 text-white" />
                </div>
                <div className="col-span-4 sm:col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeRow(idx)} className="h-9 w-9 text-slate-500 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addRow} className="w-full border-dashed border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/40">
              <Plus className="w-4 h-4 mr-1" /> Adicionar mais uma linha
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span><span className="text-white font-semibold">{validRows.length}</span> viatura(s) prontas para criar</span>
          </div>
          <Button onClick={submit} disabled={saving || validRows.length === 0} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
            {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> A criar…</> : <><Upload className="w-4 h-4 mr-1" /> Criar {validRows.length} rascunho(s)</>}
          </Button>
        </div>

        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          Para publicar cada viatura tens que adicionar fotos e pagar a inspeção independente. Comissão Stand: 1%.
        </p>
      </div>
    </MarketLayout>
  );
}
