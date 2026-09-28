import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, Link2, Building2, History, RefreshCw } from "lucide-react";

type Shop = { id: string; name: string; email: string | null };
type Row = {
  external_ref: string; number: string; date: string | null; total: number; client_name?: string | null;
  kind: "new" | "duplicate" | "pending" | "error"; reason?: string; vehicleId?: string | null;
};
type Result = { imported: number; duplicates: number; pending: number; errors: number; clients: number; vehicles: number; errorList: { number: string; reason: string }[] };

const FN = "admin-import-historical-invoices";
const BATCH = 100;

async function call<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES: Record<string, string[]> = {
  number: ["numero", "numerofatura", "n", "nfatura", "documento", "numerodocumento", "fatura", "invoicenumber", "number"],
  date: ["data", "dataemissao", "datadocumento", "date"],
  due_date: ["vencimento", "datavencimento", "duedate"],
  status: ["estado", "status"],
  doc_type: ["tipo", "tipodocumento", "type"],
  client_name: ["cliente", "nomecliente", "nome", "client", "clientname"],
  client_nif: ["nif", "contribuinte", "nifcliente", "vat", "fiscalid", "taxid"],
  client_email: ["email", "emailcliente"],
  plate: ["matricula", "plate", "viatura"],
  subtotal: ["subtotal", "semiva", "valorsemiva", "base", "incidencia", "liquido"],
  vat_total: ["iva", "valoriva", "impostos", "taxes", "vattotal"],
  total: ["total", "valortotal", "totalcomiva", "valor"],
  description: ["descricao", "observacoes", "notas", "description"],
  item_description: ["linha", "artigo", "produto", "descricaolinha", "item"],
  quantity: ["quantidade", "qtd", "qty"],
  unit_price: ["precounitario", "preco", "unitprice"],
  vat_rate: ["taxaiva", "iva%", "taxa", "vatrate"],
  pdf_url: ["pdf", "linkpdf", "pdfurl"],
  atcud: ["atcud"],
};
const toNum = (v: any) => {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[€\s]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s); return Number.isFinite(n) ? n : 0;
};
const toDate = (v: any) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : ""; }
  return String(v ?? "").trim();
};

async function parseCsv(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", codepage: 65001 });
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  if (!rows.length) return [];
  const keyMap: Record<string, string> = {};
  for (const h of Object.keys(rows[0])) {
    const n = norm(h.replace(/^\uFEFF/, ""));
    for (const [field, al] of Object.entries(ALIASES)) if (!Object.values(keyMap).includes(field) && al.includes(n)) { keyMap[h] = field; break; }
  }
  if (!Object.values(keyMap).includes("number")) throw new Error("O ficheiro não tem a coluna do número da fatura (ex.: \"Número\").");
  const byNumber = new Map<string, any>();
  for (const r of rows) {
    const g: Record<string, any> = {};
    for (const [h, f] of Object.entries(keyMap)) g[f] = r[h];
    const number = String(g.number ?? "").trim();
    if (!number) continue;
    let inv = byNumber.get(number);
    if (!inv) {
      inv = {
        external_ref: `csv:${number}`, source: "csv", number, date: toDate(g.date), due_date: toDate(g.due_date),
        status: g.status, doc_type: g.doc_type, client_name: g.client_name, client_nif: String(g.client_nif ?? ""),
        client_email: g.client_email, plate: g.plate, subtotal: toNum(g.subtotal), vat_total: toNum(g.vat_total),
        total: toNum(g.total), description: g.description, pdf_url: g.pdf_url, atcud: g.atcud, items: [],
      };
      byNumber.set(number, inv);
    }
    if (g.item_description) {
      const q = toNum(g.quantity) || 1, p = toNum(g.unit_price);
      inv.items.push({ description: String(g.item_description), quantity: q, unit_price: p, vat_rate: toNum(g.vat_rate), total: q * p });
    }
  }
  return [...byNumber.values()];
}

export default function AdminHistoricalInvoices() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  const [shop, setShop] = useState<Shop | null>(null);
  const [ix, setIx] = useState<{ connected: boolean; account: string | null } | null>(null);
  const [source, setSource] = useState<"invoicexpress" | "csv" | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from("shops").select("id, name, email").order("name").limit(2000).then(({ data }) => setShops((data as Shop[]) ?? []));
  }, [isSuperAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? shops.filter((x) => x.name?.toLowerCase().includes(s) || x.email?.toLowerCase().includes(s) || x.id.startsWith(s)) : shops).slice(0, 30);
  }, [shops, q]);

  const reset = () => { setSource(null); setInvoices([]); setRows([]); setResult(null); setProgress(null); };

  const loadShopData = async (s: Shop) => {
    const [l, p] = await Promise.all([
      supabase.from("historical_invoice_imports").select("*").eq("shop_id", s.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("historical_invoice_pending").select("*").eq("shop_id", s.id).is("resolved_invoice_id", null).order("created_at").limit(200),
    ]);
    setLogs(l.data ?? []); setPending(p.data ?? []);
  };

  const pickShop = async (s: Shop) => {
    setShop(s); reset(); setIx(null);
    loadShopData(s);
    try { setIx(await call({ action: "ix_status", shopId: s.id })); } catch { setIx({ connected: false, account: null }); }
  };

  const analyze = async (list: any[]) => {
    if (!shop) return;
    setBusy("A analisar…"); setRows([]); setProgress({ done: 0, total: list.length });
    const out: Row[] = [];
    try {
      for (let i = 0; i < list.length; i += 200) {
        const r = await call<{ rows: Row[]; invalid: any[] }>({ action: "analyze", shopId: shop.id, invoices: list.slice(i, i + 200) });
        out.push(...r.rows, ...r.invalid.map((x: any) => ({ external_ref: "", number: x.number, date: null, total: 0, kind: "error" as const, reason: x.reason })));
        setProgress({ done: Math.min(i + 200, list.length), total: list.length });
      }
      setRows(out);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null); setProgress(null);
  };

  const fetchIx = async () => {
    if (!shop) return;
    setBusy("A ler faturas do InvoiceXpress…");
    const all: any[] = [];
    try {
      let page = 1, total = 1;
      do {
        const r = await call<any>({ action: "fetch_ix", shopId: shop.id, page });
        all.push(...r.invoices); total = r.total_pages;
        setProgress({ done: page, total });
        page++;
      } while (page <= total && page <= 400);
      setInvoices(all);
      await analyze(all);
    } catch (e) { toast.error((e as Error).message); setBusy(null); setProgress(null); }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const list = await parseCsv(f);
      if (!list.length) return toast.error("Nenhuma fatura encontrada no ficheiro.");
      setInvoices(list);
      await analyze(list);
    } catch (e) { toast.error((e as Error).message); }
  };

  const stats = useMemo(() => ({
    total: rows.length,
    new: rows.filter((r) => r.kind === "new").length,
    dup: rows.filter((r) => r.kind === "duplicate").length,
    pending: rows.filter((r) => r.kind === "pending").length,
    err: rows.filter((r) => r.kind === "error").length,
    veh: rows.filter((r) => r.kind === "new" && r.vehicleId).length,
  }), [rows]);

  const runImport = async () => {
    if (!shop || !source) return;
    setConfirm(false); setBusy("A importar…");
    const acc: Result = { imported: 0, duplicates: 0, pending: 0, errors: 0, clients: 0, vehicles: 0, errorList: [] };
    let importId = "";
    try {
      importId = (await call<any>({ action: "start", shopId: shop.id, source, found: invoices.length })).importId;
      for (let i = 0; i < invoices.length; i += BATCH) {
        setProgress({ done: i, total: invoices.length });
        const r = await call<any>({ action: "import", shopId: shop.id, importId, invoices: invoices.slice(i, i + BATCH) });
        acc.imported += r.imported; acc.duplicates += r.duplicates; acc.pending += r.pending; acc.errors += r.errors;
        acc.clients += r.clients; acc.vehicles += r.vehicles; acc.errorList.push(...(r.error_list ?? []));
      }
      setProgress({ done: invoices.length, total: invoices.length });
      await call({ action: "finish", importId, status: "completed" });
      toast.success(`${acc.imported} faturas importadas para ${shop.name}`);
    } catch (e) {
      toast.error(`Importação interrompida: ${(e as Error).message}. Pode repetir — não cria duplicados.`);
      if (importId) await call({ action: "finish", importId, status: "interrupted" }).catch(() => {});
    }
    setResult(acc); setRows([]); setBusy(null); loadShopData(shop);
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Importar faturas históricas</h1>
        <p className="text-sm text-muted-foreground">As faturas ficam marcadas como históricas e não entram nos totais nem relatórios da oficina.</p>
      </div>

      {/* Passo 1 */}
      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> 1. Selecionar oficina</div>
        {shop ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
            <div>
              <div className="font-semibold">{shop.name}</div>
              <div className="text-xs text-muted-foreground">{shop.email ?? "sem email"} · {shop.id}</div>
            </div>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => { setShop(null); reset(); }}>Mudar oficina</Button>
          </div>
        ) : (
          <>
            <Input placeholder="Procurar oficina por nome, email ou ID…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-72 overflow-auto divide-y rounded-md border">
              {filtered.map((s) => (
                <button key={s.id} onClick={() => pickShop(s)} className="w-full text-left p-3 hover:bg-muted min-h-[44px]">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </button>
              ))}
              {!filtered.length && <div className="p-3 text-sm text-muted-foreground">Nenhuma oficina encontrada.</div>}
            </div>
          </>
        )}
      </Card>

      {shop && (
        <Card className="p-4 space-y-3">
          <div className="font-semibold">2. Escolher origem</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <button disabled={!ix?.connected || !!busy} onClick={() => { reset(); setSource("invoicexpress"); }}
              className={`rounded-md border p-4 text-left min-h-[44px] disabled:opacity-50 ${source === "invoicexpress" ? "border-primary bg-primary/5" : ""}`}>
              <div className="font-medium flex items-center gap-2"><Link2 className="w-4 h-4" /> InvoiceXpress da oficina</div>
              <div className="text-xs text-muted-foreground mt-1">
                {ix == null ? "A verificar ligação…" : ix.connected ? `Conta ligada: ${ix.account}` : "Esta oficina não tem o InvoiceXpress ligado."}
              </div>
            </button>
            <button disabled={!!busy} onClick={() => { reset(); setSource("csv"); }}
              className={`rounded-md border p-4 text-left min-h-[44px] ${source === "csv" ? "border-primary bg-primary/5" : ""}`}>
              <div className="font-medium flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Ficheiro CSV / Excel</div>
              <div className="text-xs text-muted-foreground mt-1">Colunas: Número, Data, Cliente, NIF, Email, Matrícula, Sem IVA, IVA, Total (e opcionalmente linhas).</div>
            </button>
          </div>
          {source === "invoicexpress" && (
            <Button onClick={fetchIx} disabled={!!busy}>3. Analisar faturas do InvoiceXpress</Button>
          )}
          {source === "csv" && (
            <Input type="file" accept=".csv,.xlsx,.xls" disabled={!!busy} onChange={(e) => onFile(e.target.files?.[0])} />
          )}
        </Card>
      )}

      {busy && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> {busy} {progress && `${progress.done.toLocaleString("pt-PT")} / ${progress.total.toLocaleString("pt-PT")}`}</div>
          {progress && progress.total > 0 && <Progress value={(progress.done / progress.total) * 100} />}
        </Card>
      )}

      {shop && rows.length > 0 && !busy && (
        <Card className="p-4 space-y-3">
          <div className="font-semibold">4. Pré-visualização — nada foi gravado</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Stat label="Faturas encontradas" v={stats.total} />
            <Stat label="Novas (cliente identificado)" v={stats.new} />
            <Stat label="Já existentes" v={stats.dup} />
            <Stat label="Com viatura identificada" v={stats.veh} />
            <Stat label="Por associar (sem cliente seguro)" v={stats.pending} />
            <Stat label="Com erro" v={stats.err} />
          </div>
          <div className="max-h-80 overflow-auto rounded-md border divide-y text-sm">
            {rows.slice(0, 500).map((r, i) => (
              <div key={i} className="p-2 flex flex-wrap items-center gap-2">
                <Badge variant={r.kind === "new" ? "default" : r.kind === "error" ? "destructive" : "secondary"}>
                  {{ new: "Nova", duplicate: "Duplicada", pending: "Por associar", error: "Erro" }[r.kind]}
                </Badge>
                <span className="font-mono">{r.number}</span>
                <span className="text-muted-foreground">{r.date}</span>
                <span>{r.client_name}</span>
                <span className="ml-auto">{Number(r.total || 0).toFixed(2)} €</span>
                {r.reason && <span className="w-full text-xs text-muted-foreground">{r.reason}</span>}
              </div>
            ))}
          </div>
          <Button disabled={stats.new + stats.pending === 0} onClick={() => setConfirm(true)}>5. Importar para {shop.name}</Button>
        </Card>
      )}

      {result && shop && (
        <Card className="p-4 space-y-3">
          <div className="font-semibold">Resultado — {shop.name}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Stat label="Importadas" v={result.imported} />
            <Stat label="Ignoradas por duplicado" v={result.duplicates} />
            <Stat label="Por associar" v={result.pending} />
            <Stat label="Clientes associados" v={result.clients} />
            <Stat label="Viaturas associadas" v={result.vehicles} />
            <Stat label="Com erro" v={result.errors} />
          </div>
          {result.errorList.length > 0 && (
            <div className="max-h-60 overflow-auto text-xs border rounded-md divide-y">
              {result.errorList.map((e, i) => <div key={i} className="p-2"><span className="font-mono">{e.number}</span> — {e.reason}</div>)}
            </div>
          )}
        </Card>
      )}

      {shop && pending.length > 0 && <PendingList shop={shop} items={pending} onDone={() => loadShopData(shop)} />}

      {shop && logs.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Histórico de importações</div>
          <div className="divide-y text-sm">
            {logs.map((l) => (
              <div key={l.id} className="py-2 flex flex-wrap gap-x-4 gap-y-1">
                <span>{new Date(l.created_at).toLocaleString("pt-PT")}</span>
                <span>{l.source === "invoicexpress" ? "InvoiceXpress" : "CSV/Excel"}</span>
                <span className="text-muted-foreground">{l.admin_email}</span>
                <Badge variant={l.status === "completed" ? "default" : "secondary"}>{l.status === "completed" ? "Concluída" : l.status === "running" ? "Em curso" : "Interrompida"}</Badge>
                <span className="w-full text-xs text-muted-foreground">
                  Encontradas {l.found} · Importadas {l.imported} · Duplicadas {l.duplicates} · Por associar {l.pending} · Erros {l.errors}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Está prestes a importar dados para: {shop?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Faturas a importar: {stats.new.toLocaleString("pt-PT")} · Por associar: {stats.pending} · Duplicadas ignoradas: {stats.dup}.
              Confirma que pretende importar estas faturas para <strong>{shop?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runImport}>Confirmar importação</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xl font-bold">{v.toLocaleString("pt-PT")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PendingList({ shop, items, onDone }: { shop: Shop; items: any[]; onDone: () => void }) {
  const [clients, setClients] = useState<{ id: string; name: string; nif: string | null }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; client_id: string }[]>([]);
  const [sel, setSel] = useState<Record<string, { c?: string; v?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [cq, setCq] = useState("");

  useEffect(() => {
    supabase.from("clients").select("id, name, nif").eq("shop_id", shop.id).is("deleted_at", null).order("name").limit(5000)
      .then(({ data }) => setClients((data as any) ?? []));
    supabase.from("vehicles").select("id, plate, client_id").eq("shop_id", shop.id).is("deleted_at", null).limit(10000)
      .then(({ data }) => setVehicles((data as any) ?? []));
  }, [shop.id]);

  const opts = useMemo(() => {
    const s = cq.trim().toLowerCase();
    return (s ? clients.filter((c) => c.name?.toLowerCase().includes(s) || c.nif?.includes(s)) : clients).slice(0, 300);
  }, [clients, cq]);

  const resolve = async (p: any) => {
    const s = sel[p.id];
    if (!s?.c) return toast.error("Escolha o cliente");
    setBusy(p.id);
    try {
      await call({ action: "resolve_pending", pendingId: p.id, clientId: s.c, vehicleId: s.v || null });
      toast.success(`Fatura ${p.payload?.number} associada`);
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Faturas por associar ({items.length})</div>
        <Button variant="ghost" size="sm" onClick={onDone}><RefreshCw className="w-4 h-4" /></Button>
      </div>
      <Input placeholder="Filtrar clientes por nome ou NIF…" value={cq} onChange={(e) => setCq(e.target.value)} />
      <div className="divide-y text-sm max-h-[480px] overflow-auto">
        {items.map((p) => {
          const s = sel[p.id] ?? {};
          return (
            <div key={p.id} className="py-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className="font-mono">{p.payload?.number}</span>
                <span className="text-muted-foreground">{p.payload?.date}</span>
                <span>{p.payload?.client_name ?? "—"}</span>
                <span className="text-muted-foreground">NIF {p.payload?.client_nif || "—"}</span>
                <span className="ml-auto">{Number(p.payload?.total || 0).toFixed(2)} €</span>
                <span className="w-full text-xs text-muted-foreground">{p.reason}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="h-11 rounded-md border bg-background px-2 flex-1 min-w-[180px]" value={s.c ?? ""}
                  onChange={(e) => setSel({ ...sel, [p.id]: { c: e.target.value } })}>
                  <option value="">Escolher cliente…</option>
                  {opts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.nif ? ` · ${c.nif}` : ""}</option>)}
                </select>
                <select className="h-11 rounded-md border bg-background px-2 flex-1 min-w-[140px]" value={s.v ?? ""} disabled={!s.c}
                  onChange={(e) => setSel({ ...sel, [p.id]: { ...s, v: e.target.value } })}>
                  <option value="">Sem viatura</option>
                  {vehicles.filter((v) => v.client_id === s.c).map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
                </select>
                <Button disabled={busy === p.id} onClick={() => resolve(p)}>{busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Associar"}</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
