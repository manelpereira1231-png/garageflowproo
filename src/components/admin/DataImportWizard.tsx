import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Building2, CheckCircle2, AlertTriangle, XCircle,
  Loader2, ArrowRight, ArrowLeft, Search, RefreshCw,
} from "lucide-react";
import {
  analyzeFile, extractRecords, FIELD_LABELS, CLIENT_FIELDS, VEHICLE_FIELDS,
  SUPPORTED_EXTENSIONS, type FieldKey, type FileAnalysis, type ParsedRecord, type SheetAnalysis,
} from "@/lib/importAnalyzer";

type Shop = { id: string; name: string; email: string | null };
type RowResult = {
  rowNumber: number; sheet: string; status: "imported" | "skipped" | "error";
  clientAction?: string; vehicleAction?: string; message?: string;
};

const STEPS = ["Oficina", "Ficheiro", "Mapeamento", "Pré-visualização", "Resultado"];

export default function DataImportWizard() {
  const [step, setStep] = useState(0);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopQuery, setShopQuery] = useState("");
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);

  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [sheets, setSheets] = useState<SheetAnalysis[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadShops = async () => {
    setShopsLoading(true);
    const { data, error } = await supabase.from("shops").select("id, name, email").order("name").limit(500);
    if (error) toast.error("Não foi possível carregar as oficinas");
    setShops((data as Shop[]) || []);
    setShopsLoading(false);
  };

  const filteredShops = useMemo(() => {
    const q = shopQuery.trim().toLowerCase();
    if (!q) return shops.slice(0, 40);
    return shops.filter((s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)).slice(0, 40);
  }, [shops, shopQuery]);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const result = await analyzeFile(file);
      setAnalysis(result);
      setSheets(result.sheets);
      setStep(2);
      toast.success(`Ficheiro analisado: ${result.sheets.length} folha(s) detetada(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const setMapping = (sheetName: string, colIndex: number, field: FieldKey | null) => {
    setSheets((prev) => prev.map((s) => {
      if (s.name !== sheetName) return s;
      const mapping = { ...s.mapping };
      if (field) {
        for (const k of Object.keys(mapping)) if (mapping[Number(k)] === field) mapping[Number(k)] = null;
      }
      mapping[colIndex] = field;
      return { ...s, mapping };
    }));
  };

  const toggleSheet = (sheetName: string) =>
    setSheets((prev) => prev.map((s) => (s.name === sheetName ? { ...s, include: !s.include } : s)));

  const records: ParsedRecord[] = useMemo(() => (sheets.length ? extractRecords(sheets) : []), [sheets]);
  const validRecords = records.filter((r) => r.errors.length === 0);
  const errorRecords = records.filter((r) => r.errors.length > 0);
  const warnRecords = validRecords.filter((r) => r.warnings.length > 0);

  const runImport = async (dryRun: boolean) => {
    if (!shop) return;
    setImporting(true);
    try {
      const chunks: ParsedRecord[][] = [];
      for (let i = 0; i < validRecords.length; i += 500) chunks.push(validRecords.slice(i, i + 500));
      const all: RowResult[] = [];
      const agg: Record<string, number> = {};
      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke("admin-import-clients-vehicles", {
          body: {
            shopId: shop.id,
            dryRun,
            records: chunk.map((r) => ({ rowNumber: r.rowNumber, sheet: r.sheet, client: r.client, vehicle: r.vehicle })),
          },
        });
        if (error) throw new Error((error as any)?.message || "Falha na importação");
        if ((data as any)?.error) throw new Error((data as any).error);
        all.push(...(((data as any).results as RowResult[]) || []));
        for (const [k, v] of Object.entries((data as any).summary || {})) agg[k] = (agg[k] || 0) + Number(v);
      }
      setResults(all);
      setSummary(agg);
      if (!dryRun) {
        setStep(4);
        toast.success(`Importação concluída: ${agg.imported || 0} linha(s) importada(s)`);
      } else {
        toast.success("Simulação concluída — reveja o resultado antes de confirmar");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(0); setAnalysis(null); setSheets([]); setResults(null); setSummary(null); setShop(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importação de Clientes e Viaturas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Carregue o ficheiro da oficina tal como ele existe. O sistema analisa a estrutura, sugere o mapeamento
          e só grava depois da sua confirmação.
        </p>
      </div>

      {/* Passos */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              i === step ? "bg-primary text-primary-foreground border-primary"
                : i < step ? "bg-muted text-foreground border-border" : "text-muted-foreground border-border"}`}>
              <span>{i + 1}</span><span>{label}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* 1 — Oficina */}
      {step === 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold"><Building2 className="w-4 h-4" /> Escolher oficina de destino</div>
          <p className="text-sm text-muted-foreground">
            Todos os dados importados pertencem exclusivamente à oficina selecionada. Nunca são misturados entre oficinas.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Pesquisar oficina por nome ou email"
                value={shopQuery} onChange={(e) => setShopQuery(e.target.value)} onFocus={() => { if (!shops.length) loadShops(); }} />
            </div>
            <Button variant="outline" onClick={loadShops} disabled={shopsLoading}>
              {shopsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
          <div className="max-h-72 overflow-auto divide-y rounded-md border">
            {!shops.length && <div className="p-4 text-sm text-muted-foreground">Carregue a lista para escolher a oficina.</div>}
            {filteredShops.map((s) => (
              <button key={s.id} onClick={() => { setShop(s); setStep(1); }}
                className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition ${shop?.id === s.id ? "bg-muted" : ""}`}>
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.email || "—"}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 2 — Ficheiro */}
      {step === 1 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold"><Upload className="w-4 h-4" /> Carregar ficheiro</div>
          <div className="text-sm text-muted-foreground">
            Oficina: <span className="font-medium text-foreground">{shop?.name}</span>
          </div>
          <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition">
            <input ref={fileInput} type="file" className="hidden"
              accept={SUPPORTED_EXTENSIONS.map((e) => "." + e).join(",")}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-sm"><Loader2 className="w-6 h-6 animate-spin" />A analisar o ficheiro…</div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                <div className="text-sm font-medium">Clique para escolher o ficheiro</div>
                <div className="text-xs text-muted-foreground">
                  Formatos aceites: {SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")} — sem modelo obrigatório
                </div>
              </div>
            )}
          </label>
          <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-2" />Mudar de oficina</Button>
        </Card>
      )}

      {/* 3 — Mapeamento */}
      {step === 2 && analysis && (
        <div className="space-y-4">
          <Card className="p-5 space-y-2">
            <div className="font-semibold">Estrutura detetada em “{analysis.fileName}”</div>
            <p className="text-sm text-muted-foreground">
              Confirme o que cada coluna representa. Colunas sem correspondência ficam por importar — nada é inventado.
            </p>
          </Card>

          {sheets.map((sheet) => (
            <Card key={sheet.name} className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {sheet.name}
                    <Badge variant="outline">
                      {sheet.kind === "clients" ? "Clientes" : sheet.kind === "vehicles" ? "Viaturas"
                        : sheet.kind === "mixed" ? "Clientes + Viaturas" : "Estrutura não reconhecida"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {sheet.totalRows} linha(s) · cabeçalho {sheet.headerRowIndex >= 0 ? `na linha ${sheet.headerRowIndex + 1}` : "não detetado"}
                  </div>
                </div>
                <Button size="sm" variant={sheet.include ? "default" : "outline"} onClick={() => toggleSheet(sheet.name)}>
                  {sheet.include ? "Incluir esta folha" : "Ignorar esta folha"}
                </Button>
              </div>

              {sheet.include && (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 pr-3">Coluna no ficheiro</th>
                        <th className="py-2 pr-3">Exemplos</th>
                        <th className="py-2 pr-3">Campo GarageFlow</th>
                        <th className="py-2">Sugestão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.columns.map((col) => {
                        const sug = sheet.suggestions[col.index];
                        return (
                          <tr key={col.index} className="border-b last:border-0 align-top">
                            <td className="py-2 pr-3 font-medium">{col.header}</td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[240px] truncate">
                              {col.samples.slice(0, 3).join(" · ") || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                className="w-56 h-9 rounded-md border bg-background px-2 text-sm"
                                value={sheet.mapping[col.index] ?? ""}
                                onChange={(e) => setMapping(sheet.name, col.index, (e.target.value || null) as FieldKey | null)}
                              >
                                <option value="">— Não importar —</option>
                                <optgroup label="Cliente">
                                  {CLIENT_FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                                </optgroup>
                                <optgroup label="Viatura">
                                  {VEHICLE_FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                                </optgroup>
                              </select>
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {sug?.field ? `${FIELD_LABELS[sug.field]} (${Math.round(sug.confidence * 100)}%)` : sug?.reason || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" />Trocar ficheiro</Button>
            <Button onClick={() => setStep(3)} disabled={!records.length}>
              Pré-visualizar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* 4 — Pré-visualização */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">Linhas lidas</div><div className="text-2xl font-bold">{records.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Prontas a importar</div><div className="text-2xl font-bold text-emerald-500">{validRecords.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Com avisos</div><div className="text-2xl font-bold text-amber-500">{warnRecords.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Com erro</div><div className="text-2xl font-bold text-destructive">{errorRecords.length}</div></Card>
          </div>

          <Card className="p-5 space-y-3">
            <div className="font-semibold">Dados que serão importados para “{shop?.name}”</div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Linha</th><th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Contactos</th><th className="py-2 pr-3">Viatura</th><th className="py-2">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {validRecords.slice(0, 200).map((r) => (
                    <tr key={`${r.sheet}-${r.rowNumber}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{r.sheet}:{r.rowNumber}</td>
                      <td className="py-2 pr-3">{r.client.name || "—"}</td>
                      <td className="py-2 pr-3 text-xs">{[r.client.phone, r.client.email].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="py-2 pr-3 text-xs">
                        {r.vehicle.plate ? `${r.vehicle.plate} · ${[r.vehicle.make, r.vehicle.model, r.vehicle.version].filter(Boolean).join(" ")}` : "—"}
                      </td>
                      <td className="py-2 text-xs text-amber-500">{r.warnings.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validRecords.length > 200 && (
                <div className="text-xs text-muted-foreground pt-2">A mostrar as primeiras 200 de {validRecords.length} linhas.</div>
              )}
            </div>
          </Card>

          {errorRecords.length > 0 && (
            <Card className="p-5 space-y-3 border-destructive/40">
              <div className="font-semibold flex items-center gap-2 text-destructive">
                <XCircle className="w-4 h-4" /> Linhas que não serão importadas ({errorRecords.length})
              </div>
              <p className="text-xs text-muted-foreground">
                Corrija estas linhas no ficheiro e importe apenas essas depois. As restantes {validRecords.length} continuam a ser importadas.
              </p>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <tbody>
                    {errorRecords.slice(0, 200).map((r) => (
                      <tr key={`e-${r.sheet}-${r.rowNumber}`} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{r.sheet}:{r.rowNumber}</td>
                        <td className="py-2 pr-3">{r.client.name || r.vehicle.plate || "—"}</td>
                        <td className="py-2 text-xs text-destructive">{r.errors.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {results && summary && (
            <Card className="p-5 space-y-2 border-primary/40">
              <div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Simulação (nada foi gravado)</div>
              <div className="text-sm text-muted-foreground">
                Novos clientes: {summary.clientsCreated || 0} · Novas viaturas: {summary.vehiclesCreated || 0} ·
                Já existentes: {summary.skipped || 0} · Viaturas duplicadas ignoradas: {summary.duplicateVehicles || 0} ·
                Erros: {summary.errors || 0}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-2" />Rever mapeamento</Button>
            <Button variant="outline" onClick={() => runImport(true)} disabled={importing || !validRecords.length}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Simular (sem gravar)
            </Button>
            <Button onClick={() => runImport(false)} disabled={importing || !validRecords.length}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar importação ({validRecords.length})
            </Button>
          </div>
        </div>
      )}

      {/* 5 — Resultado */}
      {step === 4 && summary && results && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">Importadas</div><div className="text-2xl font-bold text-emerald-500">{summary.imported || 0}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Já existentes</div><div className="text-2xl font-bold">{summary.skipped || 0}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Com erro</div><div className="text-2xl font-bold text-destructive">{summary.errors || 0}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Novas viaturas</div><div className="text-2xl font-bold">{summary.vehiclesCreated || 0}</div></Card>
          </div>

          <Card className="p-5 space-y-3">
            <div className="font-semibold">Detalhe por linha</div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <tbody>
                  {results.map((r) => (
                    <tr key={`r-${r.sheet}-${r.rowNumber}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{r.sheet}:{r.rowNumber}</td>
                      <td className="py-2 pr-3">
                        {r.status === "imported" && <Badge className="bg-emerald-600">Importada</Badge>}
                        {r.status === "skipped" && <Badge variant="outline">Ignorada</Badge>}
                        {r.status === "error" && <Badge variant="destructive">Erro</Badge>}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{r.message || `${r.clientAction === "created" ? "Cliente criado" : "Cliente existente"}${r.vehicleAction === "created" ? " · Viatura criada" : ""}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Button onClick={reset}><Upload className="w-4 h-4 mr-2" />Nova importação</Button>
        </div>
      )}
    </div>
  );
}
