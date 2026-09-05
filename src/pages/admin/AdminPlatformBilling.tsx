/**
 * Admin → Financeiro → Faturação GarageFlow
 *
 * Faturação GARAGEFLOW → OFICINA (subscrições SaaS).
 * Não toca na faturação OFICINA → CLIENTE (InvoiceXpress/Moloni/eNotas das oficinas).
 *
 * Estado inicial: PREPARADO / NÃO ATIVO. Nada é emitido enquanto a entidade
 * legal e a configuração fiscal não estiverem completas e validadas.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, CircleDollarSign, RefreshCw, Target, Plug,
  FileText, Mail, ShieldCheck, Send, XCircle, Clock,
} from "lucide-react";

interface StatusResp {
  settings: any;
  paying_shops: number;
  target: number;
  milestone_reached: boolean;
  checklist: Record<string, boolean>;
  blocking: string[];
  ready_to_activate: boolean;
  fiscal_billing_active: boolean;
}

interface InvoiceRow {
  id: string;
  shop_id: string | null;
  plan: string | null;
  currency: string;
  amount_net: number;
  vat_amount: number;
  amount_total: number;
  fiscal_status: string;
  provider_number: string | null;
  provider_pdf_url: string | null;
  stripe_invoice_id: string | null;
  stripe_hosted_url: string | null;
  email_status: string;
  email_error: string | null;
  last_error: string | null;
  paid_at: string | null;
  created_at: string;
}

const CHECKLIST_LABELS: Record<string, string> = {
  paying_shops: "20 oficinas pagantes atingidas",
  company_incorporated: "Empresa constituída",
  tax_id: "NIF configurado",
  legal_name: "Nome legal configurado",
  legal_address: "Morada / dados legais configurados",
  vat_regime: "Regime de IVA configurado",
  ix_configured: "InvoiceXpress configurado",
  ix_connection_ok: "Autenticação InvoiceXpress validada",
  series: "Série configurada",
  test_issue_done: "Teste de emissão concluído",
  email_validated: "Email validado",
  stripe_flow_tested: "Fluxo Stripe → faturação testado",
  accounting_validated: "Configuração fiscal validada (contabilidade)",
};

const MANUAL_KEYS = [
  "company_incorporated", "test_issue_done", "email_validated",
  "stripe_flow_tested", "accounting_validated",
];

const money = (v: number, c = "EUR") =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: c || "EUR" }).format(Number(v || 0));

/** Semáforo de reconciliação por linha. */
function reconcile(r: InvoiceRow): { level: "ok" | "warn" | "error" | "critical"; label: string } {
  if (r.fiscal_status === "error") return { level: "error", label: "ERRO — falha na emissão" };
  if (r.fiscal_status === "cancelled") return { level: "warn", label: "Documento anulado" };
  if (r.fiscal_status === "issued") {
    if (!r.shop_id) return { level: "critical", label: "CRÍTICO — fatura sem oficina associada" };
    if (r.email_status === "failed") return { level: "warn", label: "ATENÇÃO — email por entregar" };
    return { level: "ok", label: "OK" };
  }
  if (!r.shop_id) return { level: "critical", label: "CRÍTICO — pagamento sem oficina associada" };
  return { level: "warn", label: "ATENÇÃO — fatura pendente" };
}

export default function AdminPlatformBilling() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [shopNames, setShopNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [apiKey, setApiKey] = useState("");
  const [filter, setFilter] = useState("all");

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("platform-billing", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error && data?.ok !== true) throw new Error(data.error);
    return data;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const st = await call("status");
      setStatus(st);
      setForm(st.settings ?? {});
    } catch (e) {
      toast.error(`Não foi possível ler o estado: ${(e as Error).message}`);
    }
    const { data } = await supabase
      .from("platform_invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data as InvoiceRow[]) ?? [];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.shop_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: shops } = await supabase.from("shops").select("id,name").in("id", ids);
      setShopNames(Object.fromEntries((shops ?? []).map((s: any) => [s.id, s.name])));
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      const r = await fn();
      if (r?.ok === false) throw new Error(r.error || "Falhou");
      toast.success("Feito.");
      await loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "issued") return rows.filter((r) => r.fiscal_status === "issued");
    if (filter === "pending") return rows.filter((r) => r.fiscal_status === "pending_config" || r.fiscal_status === "queued");
    if (filter === "error") return rows.filter((r) => r.fiscal_status === "error");
    if (filter === "email_sent") return rows.filter((r) => r.email_status === "sent");
    if (filter === "email_failed") return rows.filter((r) => r.email_status === "failed");
    return rows;
  }, [rows, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const active = status?.fiscal_billing_active === true;
  const paying = status?.paying_shops ?? 0;
  const target = status?.target ?? 20;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CircleDollarSign className="w-6 h-6 text-primary" /> Faturação GarageFlow
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Faturação das subscrições que o GarageFlow cobra às oficinas. Não afeta as faturas que as oficinas emitem aos seus clientes.
        </p>
      </div>

      {/* Banner de estado */}
      <Card className={`p-4 border-l-4 ${active ? "border-l-emerald-500" : "border-l-amber-500"}`}>
        <div className="flex items-start gap-3">
          {active ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />}
          <div className="flex-1">
            <p className="font-semibold">
              {active ? "✅ FATURAÇÃO FISCAL DO GARAGEFLOW ATIVA" : "⚠️ FATURAÇÃO FISCAL DO GARAGEFLOW NÃO ATIVA"}
            </p>
            <p className="text-sm text-muted-foreground">
              {active
                ? "Cada pagamento confirmado gera documento fiscal via InvoiceXpress e email para a oficina."
                : "Os pagamentos Stripe continuam a funcionar e ficam registados, mas nenhum documento fiscal é emitido enquanto a entidade legal e a configuração fiscal não estiverem prontas."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
        </div>
      </Card>

      {/* Marco das 20 oficinas */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-semibold">Oficinas pagantes: {paying} / {target}</span>
          <Badge variant={active ? "default" : "secondary"} className="ml-auto">
            Faturação GarageFlow: {active ? "Ativa" : "Preparação"}
          </Badge>
        </div>
        <Progress value={Math.min(100, (paying / Math.max(1, target)) * 100)} className="h-2" />
        {status?.milestone_reached && (
          <p className="mt-3 text-sm font-semibold text-emerald-600">
            🎯 MARCO ATINGIDO — {target} OFICINAS PAGANTES · Faturação do GarageFlow: pronta para preparar a ativação
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Contagem: subscrições ativas/em atraso com pagamento Stripe, excluindo contas de demonstração.
          Atingir o marco não ativa a emissão fiscal — a ativação é sempre manual e depende do checklist.
        </p>
      </Card>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Dados fiscais</TabsTrigger>
          <TabsTrigger value="checklist">Checklist de ativação</TabsTrigger>
          <TabsTrigger value="invoices">Faturas & reconciliação</TabsTrigger>
        </TabsList>

        {/* ───────────── DADOS FISCAIS ───────────── */}
        <TabsContent value="config" className="space-y-4 pt-4">
          <Card className="p-4 space-y-4">
            <p className="text-sm font-semibold">Entidade legal do GarageFlow</p>
            <p className="text-xs text-muted-foreground">
              Preencher só quando a empresa estiver constituída. Não introduzir dados fiscais fictícios.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="Nome legal"><Input value={form.legal_name ?? ""} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></Fld>
              <Fld label="NIF"><Input value={form.tax_id ?? ""} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></Fld>
              <Fld label="Morada"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Fld>
              <Fld label="Código postal"><Input value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></Fld>
              <Fld label="Localidade"><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Fld>
              <Fld label="País"><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Fld>
              <Fld label="Regime de IVA"><Input placeholder="ex.: Regime normal" value={form.vat_regime ?? ""} onChange={(e) => setForm({ ...form, vat_regime: e.target.value })} /></Fld>
              <Fld label="Taxa de IVA (%)"><Input type="number" value={form.vat_rate ?? 23} onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })} /></Fld>
              <Fld label="Meta de oficinas pagantes"><Input type="number" value={form.paying_shops_target ?? 20} onChange={(e) => setForm({ ...form, paying_shops_target: Number(e.target.value) })} /></Fld>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2"><Plug className="w-4 h-4" /> InvoiceXpress do GarageFlow</p>
            <p className="text-xs text-muted-foreground">
              Conta separada da integração InvoiceXpress de cada oficina — aqui é a conta da própria empresa GarageFlow.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="Conta (subdomínio)"><Input placeholder="garageflow" value={form.ix_account_name ?? ""} onChange={(e) => setForm({ ...form, ix_account_name: e.target.value })} /></Fld>
              <Fld label="API key">
                <Input type="password" placeholder={form.ix_api_key_set ? "•••••••• (deixa em branco para manter)" : "Cola a API key"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="new-password" />
              </Fld>
              <Fld label="Tipo de documento">
                <Select value={form.ix_document_type ?? "invoice_receipt"} onValueChange={(v) => setForm({ ...form, ix_document_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Fatura</SelectItem>
                    <SelectItem value="invoice_receipt">Fatura-recibo</SelectItem>
                    <SelectItem value="simplified_invoice">Fatura simplificada</SelectItem>
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label="Série (sequence id)"><Input value={form.ix_sequence_id ?? ""} onChange={(e) => setForm({ ...form, ix_sequence_id: e.target.value })} /></Fld>
            </div>
            {form.ix_last_check_at && (
              <p className="text-xs text-muted-foreground">
                Último teste: {new Date(form.ix_last_check_at).toLocaleString("pt-PT")} —{" "}
                {form.ix_connection_ok ? "ligação OK" : `falhou: ${form.ix_last_error ?? "erro desconhecido"}`}
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button
                disabled={busy !== null}
                onClick={() => run("save", async () => {
                  const r = await call("save_settings", { settings: { ...form, ix_api_key: apiKey || undefined } });
                  setApiKey("");
                  return r;
                })}
              >
                Guardar
              </Button>
              <Button variant="outline" disabled={busy !== null} onClick={() => run("test", () => call("test_ix"))}>
                <ShieldCheck className="w-4 h-4 mr-1" /> Testar ligação InvoiceXpress
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ───────────── CHECKLIST ───────────── */}
        <TabsContent value="checklist" className="space-y-4 pt-4">
          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">GARAGEFLOW — ATIVAÇÃO DE FATURAÇÃO</p>
            <div className="space-y-2">
              {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                const done = status?.checklist?.[key] === true;
                const manual = MANUAL_KEYS.includes(key);
                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {manual ? (
                      <Checkbox
                        checked={done}
                        onCheckedChange={(v) => run("chk", () => call("save_settings", {
                          settings: { checklist: { ...(form.checklist ?? {}), [key]: v === true } },
                        }))}
                      />
                    ) : done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={done ? "" : "text-muted-foreground"}>{label}</span>
                    {!manual && <Badge variant="outline" className="ml-auto text-[10px]">automático</Badge>}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              {status?.ready_to_activate ? (
                <p className="text-sm font-semibold text-emerald-600 mb-3">✅ PRONTO PARA ATIVAR</p>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">
                  Em falta: {(status?.blocking ?? []).map((k) => CHECKLIST_LABELS[k] ?? k).join(" · ")}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  disabled={!status?.ready_to_activate || active || busy !== null}
                  onClick={() => run("activate", () => call("activate"))}
                >
                  ATIVAR FATURAÇÃO
                </Button>
                {active && (
                  <Button variant="destructive" disabled={busy !== null} onClick={() => run("deactivate", () => call("deactivate"))}>
                    Desativar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ───────────── FATURAS ───────────── */}
        <TabsContent value="invoices" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="issued">Fatura emitida</SelectItem>
                  <SelectItem value="pending">Fatura pendente</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="email_sent">Email enviado</SelectItem>
                  <SelectItem value="email_failed">Email falhado</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("sync", () => call("sync_stripe"))}>
                <RefreshCw className="w-4 h-4 mr-1" /> Importar cobranças do Stripe
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">{filtered.length} registos</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Oficina</th>
                    <th className="text-left py-2 px-2">Plano</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="text-right py-2 px-2">IVA</th>
                    <th className="text-right py-2 px-2">Total</th>
                    <th className="text-left py-2 px-2">Stripe</th>
                    <th className="text-left py-2 px-2">Fatura</th>
                    <th className="text-left py-2 px-2">InvoiceXpress</th>
                    <th className="text-left py-2 px-2">Email</th>
                    <th className="text-left py-2 px-2">Reconciliação</th>
                    <th className="text-right py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const rec = reconcile(r);
                    return (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2 px-2">{r.shop_id ? (shopNames[r.shop_id] ?? "—") : <span className="text-destructive">sem oficina</span>}</td>
                        <td className="py-2 px-2 capitalize">{r.plan ?? "—"}</td>
                        <td className="py-2 px-2 text-right">{money(r.amount_net, r.currency)}</td>
                        <td className="py-2 px-2 text-right">{money(r.vat_amount, r.currency)}</td>
                        <td className="py-2 px-2 text-right font-semibold">{money(r.amount_total, r.currency)}</td>
                        <td className="py-2 px-2">{r.stripe_invoice_id ? "✅ Confirmado" : "—"}</td>
                        <td className="py-2 px-2">
                          {r.fiscal_status === "issued"
                            ? <span className="font-medium">{r.provider_number ?? "emitida"}</span>
                            : r.fiscal_status === "error"
                              ? <Badge variant="destructive">Erro</Badge>
                              : <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>}
                        </td>
                        <td className="py-2 px-2">{r.fiscal_status === "issued" ? "✅ Sincronizado" : "—"}</td>
                        <td className="py-2 px-2">
                          {r.email_status === "sent" ? "✅ Enviado" : r.email_status === "failed" ? <Badge variant="destructive">Falhou</Badge> : "—"}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={rec.level === "ok" ? "default" : rec.level === "warn" ? "secondary" : "destructive"}>
                            {rec.label}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right space-x-1">
                          {r.fiscal_status !== "issued" && (
                            <Button size="sm" variant="outline" disabled={!active || busy !== null}
                              title={active ? "Emitir documento fiscal" : "Faturação fiscal ainda não ativa"}
                              onClick={() => run("emit", () => call("emit", { platform_invoice_id: r.id }))}>
                              <FileText className="w-3.5 h-3.5 mr-1" /> Emitir
                            </Button>
                          )}
                          {r.fiscal_status === "issued" && (
                            <Button size="sm" variant="ghost" disabled={busy !== null}
                              onClick={() => run("resend", () => call("resend_email", { platform_invoice_id: r.id }))}>
                              <Send className="w-3.5 h-3.5 mr-1" /> Reenviar email
                            </Button>
                          )}
                          {r.provider_pdf_url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={r.provider_pdf_url} target="_blank" rel="noreferrer">PDF</a>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">
                      Ainda não existem cobranças registadas.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.some((r) => r.last_error || r.email_error) && (
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold flex items-center gap-1"><Mail className="w-3 h-3" /> Últimos erros</p>
                {rows.filter((r) => r.last_error || r.email_error).slice(0, 5).map((r) => (
                  <p key={r.id}>· {shopNames[r.shop_id ?? ""] ?? r.id.slice(0, 8)}: {r.last_error ?? r.email_error}</p>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
