/**
 * AdminAccounting — Painel de Contabilidade GarageFlow (super_admin only).
 *
 * Fornece exportações contabilísticas do próprio SaaS GarageFlow:
 *  - Relatório de receita (subscrições Stripe + comissões Marketplace) por período.
 *  - Exportação CSV para envio ao contabilista.
 *  - SAF-T PT (subset "Faturação") — informativo/uncertified.
 *  - Editor dos dados fiscais da plataforma (platform_company_info).
 *
 * IMPORTANTE (regra memory://compliance/saf-t-pt-hardened-v1):
 * O sistema NÃO está certificado pela AT. Todas as exportações trazem aviso
 * legal explícito no cabeçalho, rodapé e comentário do XML.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileText, Loader2, AlertTriangle, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/pdfGenerator";

type Period = "month" | "quarter" | "year" | "custom";

interface PlatformInfo {
  id?: string;
  legal_name: string;
  tax_id: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  iban: string | null;
  accountant_email: string | null;
  accountant_name: string | null;
  notes: string | null;
}

const DEFAULT_INFO: PlatformInfo = {
  legal_name: "GarageFlow",
  tax_id: "",
  address: "",
  postal_code: "",
  city: "",
  country: "PT",
  iban: "",
  accountant_email: "",
  accountant_name: "",
  notes: "",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function firstDayOfQuarter(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
}
function firstDayOfYear(d = new Date()) { return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10); }

// Preços mensais aproximados por plano (fallback caso não existam em country_settings).
const PLAN_PRICE_EUR: Record<string, number> = { pro: 39, garage: 99, free: 0 };

function xmlEscape(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export default function AdminAccounting() {
  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [shopFilter, setShopFilter] = useState<string>("all");

  const [shops, setShops] = useState<{ id: string; name: string; nif: string | null }[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [info, setInfo] = useState<PlatformInfo>(DEFAULT_INFO);
  const [savingInfo, setSavingInfo] = useState(false);

  // Set period presets
  useEffect(() => {
    if (period === "month") { setDateFrom(firstDayOfMonth()); setDateTo(todayISO()); }
    else if (period === "quarter") { setDateFrom(firstDayOfQuarter()); setDateTo(todayISO()); }
    else if (period === "year") { setDateFrom(firstDayOfYear()); setDateTo(todayISO()); }
  }, [period]);

  // Load platform info + shops
  useEffect(() => {
    (async () => {
      const [{ data: infoRows }, { data: shopRows }] = await Promise.all([
        supabase.from("platform_company_info").select("*").limit(1),
        supabase.from("shops").select("id, name, nif").order("name"),
      ]);
      if (infoRows && infoRows[0]) setInfo({ ...DEFAULT_INFO, ...infoRows[0] });
      if (shopRows) setShops(shopRows as any);
    })();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const fromISO = new Date(dateFrom + "T00:00:00").toISOString();
      const toISO = new Date(dateTo + "T23:59:59").toISOString();

      let subsQ = supabase
        .from("subscriptions")
        .select("id, shop_id, plan, billing_cycle, status, stripe_subscription_id, current_period_end, created_at, discount_percent")
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      if (shopFilter !== "all") subsQ = subsQ.eq("shop_id", shopFilter);

      let escQ = supabase
        .from("market_escrow")
        .select("id, seller_id, buyer_id, amount, platform_fee, commission_rate, status, released_at, captured_at, created_at")
        .in("status", ["released", "captured", "completed"])
        .gte("captured_at", fromISO)
        .lte("captured_at", toISO);

      const [{ data: subsData }, { data: escData }] = await Promise.all([subsQ, escQ]);
      setSubs(subsData || []);
      setEscrows(escData || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro a carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [dateFrom, dateTo, shopFilter]);

  const totals = useMemo(() => {
    const subsRevenue = subs.reduce((sum, s) => {
      const base = PLAN_PRICE_EUR[s.plan] || 0;
      const factor = s.billing_cycle === "yearly" ? 12 : 1;
      const disc = 1 - (Number(s.discount_percent) || 0) / 100;
      return sum + base * factor * disc;
    }, 0);
    const marketCommissions = escrows.reduce((sum, e) => sum + (Number(e.platform_fee) || 0), 0);
    return { subsRevenue, marketCommissions, total: subsRevenue + marketCommissions };
  }, [subs, escrows]);

  const shopById = useMemo(() => {
    const m = new Map<string, { name: string; nif: string | null }>();
    shops.forEach((s) => m.set(s.id, { name: s.name, nif: s.nif }));
    return m;
  }, [shops]);

  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      if (info.id) {
        const { error } = await supabase.from("platform_company_info").update(info).eq("id", info.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("platform_company_info").insert(info).select().single();
        if (error) throw error;
        if (data) setInfo({ ...DEFAULT_INFO, ...data });
      }
      toast.success("Dados da empresa guardados");
    } catch (e: any) {
      toast.error(e?.message || "Erro a guardar");
    } finally {
      setSavingInfo(false);
    }
  };

  const exportCsv = () => {
    const rows: any[] = [];
    subs.forEach((s) => {
      const shop = shopById.get(s.shop_id);
      const base = PLAN_PRICE_EUR[s.plan] || 0;
      const factor = s.billing_cycle === "yearly" ? 12 : 1;
      const disc = 1 - (Number(s.discount_percent) || 0) / 100;
      rows.push({
        Tipo: "Subscrição",
        Data: (s.created_at || "").slice(0, 10),
        Oficina: shop?.name || s.shop_id,
        NIF_Cliente: shop?.nif || "",
        Plano: s.plan,
        Ciclo: s.billing_cycle,
        Estado: s.status,
        Valor_EUR: (base * factor * disc).toFixed(2),
        Stripe_Sub: s.stripe_subscription_id || "",
      });
    });
    escrows.forEach((e) => {
      const shop = shopById.get(e.seller_id);
      rows.push({
        Tipo: "Comissão Market",
        Data: (e.captured_at || e.released_at || e.created_at || "").slice(0, 10),
        Oficina: shop?.name || e.seller_id,
        NIF_Cliente: shop?.nif || "",
        Plano: "",
        Ciclo: "",
        Estado: e.status,
        Valor_EUR: Number(e.platform_fee || 0).toFixed(2),
        Stripe_Sub: "",
      });
    });
    if (rows.length === 0) { toast.error("Sem dados para exportar"); return; }
    exportToCsv(rows, `garageflow_contabilidade_${dateFrom}_${dateTo}`);
    toast.success("CSV exportado");
  };

  const exportSaftXml = () => {
    // Subset "Faturação" — SAF-T PT NÃO-CERTIFICADO. Estrutura simplificada.
    const now = new Date().toISOString();
    const totalDebit = 0;
    const totalCredit = totals.total;

    const customers = shops
      .filter((sh) => subs.some((s) => s.shop_id === sh.id) || escrows.some((e) => e.seller_id === sh.id))
      .map((sh, idx) => `
    <Customer>
      <CustomerID>C${idx + 1}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>${xmlEscape(sh.nif || "999999990")}</CustomerTaxID>
      <CompanyName>${xmlEscape(sh.name)}</CompanyName>
      <BillingAddress><AddressDetail>Desconhecido</AddressDetail><City>Desconhecido</City><PostalCode>0000-000</PostalCode><Country>PT</Country></BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`).join("");

    let invoiceIdx = 0;
    const invoices: string[] = [];
    subs.forEach((s) => {
      invoiceIdx++;
      const sh = shopById.get(s.shop_id);
      const cust = shops.findIndex((x) => x.id === s.shop_id);
      const base = PLAN_PRICE_EUR[s.plan] || 0;
      const factor = s.billing_cycle === "yearly" ? 12 : 1;
      const disc = 1 - (Number(s.discount_percent) || 0) / 100;
      const gross = base * factor * disc;
      const net = +(gross / 1.23).toFixed(2);
      const tax = +(gross - net).toFixed(2);
      invoices.push(`
      <Invoice>
        <InvoiceNo>FT GF/${String(invoiceIdx).padStart(5, "0")}</InvoiceNo>
        <ATCUD>0</ATCUD>
        <DocumentStatus><InvoiceStatus>N</InvoiceStatus><InvoiceStatusDate>${(s.created_at || now).slice(0, 19)}</InvoiceStatusDate><SourceID>GarageFlow</SourceID><SourceBilling>P</SourceBilling></DocumentStatus>
        <Hash>0</Hash>
        <HashControl>0</HashControl>
        <Period>${new Date(s.created_at || now).getMonth() + 1}</Period>
        <InvoiceDate>${(s.created_at || now).slice(0, 10)}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <SpecialRegimes><SelfBillingIndicator>0</SelfBillingIndicator><CashVATSchemeIndicator>0</CashVATSchemeIndicator><ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator></SpecialRegimes>
        <SourceID>GarageFlow</SourceID>
        <SystemEntryDate>${(s.created_at || now).slice(0, 19)}</SystemEntryDate>
        <CustomerID>C${cust + 1}</CustomerID>
        <Line>
          <LineNumber>1</LineNumber>
          <ProductCode>PLAN_${s.plan?.toUpperCase()}</ProductCode>
          <ProductDescription>Subscrição GarageFlow — Plano ${xmlEscape(s.plan)} (${xmlEscape(s.billing_cycle)})</ProductDescription>
          <Quantity>1</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${net.toFixed(2)}</UnitPrice>
          <TaxPointDate>${(s.created_at || now).slice(0, 10)}</TaxPointDate>
          <Description>Subscrição SaaS</Description>
          <CreditAmount>${net.toFixed(2)}</CreditAmount>
          <Tax><TaxType>IVA</TaxType><TaxCountryRegion>PT</TaxCountryRegion><TaxCode>NOR</TaxCode><TaxPercentage>23.00</TaxPercentage></Tax>
        </Line>
        <DocumentTotals><TaxPayable>${tax.toFixed(2)}</TaxPayable><NetTotal>${net.toFixed(2)}</NetTotal><GrossTotal>${gross.toFixed(2)}</GrossTotal></DocumentTotals>
      </Invoice>`);
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ATENÇÃO: Ficheiro SAF-T PT gerado por GarageFlow em modo INFORMATIVO.
  Este sistema NÃO está certificado pela Autoridade Tributária (AT).
  Utilize apenas como apoio ao envio de dados para o seu contabilista.
  Gerado em ${now}. Período ${dateFrom} a ${dateTo}.
-->
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${xmlEscape(info.tax_id || "999999990")}</CompanyID>
    <TaxRegistrationNumber>${xmlEscape(info.tax_id || "999999990")}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${xmlEscape(info.legal_name)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${xmlEscape(info.address || "Desconhecido")}</AddressDetail>
      <City>${xmlEscape(info.city || "Desconhecido")}</City>
      <PostalCode>${xmlEscape(info.postal_code || "0000-000")}</PostalCode>
      <Country>${xmlEscape(info.country || "PT")}</Country>
    </CompanyAddress>
    <FiscalYear>${new Date(dateFrom).getFullYear()}</FiscalYear>
    <StartDate>${dateFrom}</StartDate>
    <EndDate>${dateTo}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${now.slice(0, 10)}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${xmlEscape(info.tax_id || "999999990")}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>GarageFlow/GarageFlow</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <HeaderComment>SAF-T informativo — sistema NÃO certificado pela AT.</HeaderComment>
  </Header>
  <MasterFiles>${customers}
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${invoices.length}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>${invoices.join("")}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
    downloadFile(`SAFT_GARAGEFLOW_${dateFrom}_${dateTo}.xml`, xml, "application/xml");
    toast.success("SAF-T exportado (informativo, não certificado)");
  };

  const exportAccountantReport = () => {
    // Relatório contabilista em HTML (imprimível para PDF via Ctrl+P)
    const win = window.open("", "_blank");
    if (!win) { toast.error("Bloqueado pelo browser"); return; }
    const rowsHtml = [
      ...subs.map((s) => {
        const sh = shopById.get(s.shop_id);
        const base = PLAN_PRICE_EUR[s.plan] || 0;
        const factor = s.billing_cycle === "yearly" ? 12 : 1;
        const disc = 1 - (Number(s.discount_percent) || 0) / 100;
        const gross = (base * factor * disc).toFixed(2);
        return `<tr><td>${(s.created_at || "").slice(0, 10)}</td><td>Subscrição</td><td>${xmlEscape(sh?.name || "—")}</td><td>${xmlEscape(sh?.nif || "")}</td><td>${xmlEscape(s.plan)}</td><td style="text-align:right">€${gross}</td></tr>`;
      }),
      ...escrows.map((e) => {
        const sh = shopById.get(e.seller_id);
        return `<tr><td>${(e.captured_at || e.created_at || "").slice(0, 10)}</td><td>Comissão Market</td><td>${xmlEscape(sh?.name || "—")}</td><td>${xmlEscape(sh?.nif || "")}</td><td>—</td><td style="text-align:right">€${Number(e.platform_fee || 0).toFixed(2)}</td></tr>`;
      }),
    ].join("");

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório Contabilístico ${dateFrom} — ${dateTo}</title>
    <style>body{font-family:Arial,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#222}h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;color:#666;margin:0 0 24px;font-weight:500}
    .warn{background:#fff7ed;border-left:4px solid #f59e0b;padding:12px 14px;font-size:12px;color:#7c2d12;margin:16px 0;border-radius:4px}
    table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}th{background:#f9fafb;font-weight:600}
    .tot{margin-top:24px;padding:12px 14px;background:#f9fafb;border-radius:6px;font-size:13px}
    </style></head><body>
    <h1>Relatório Contabilístico — GarageFlow</h1>
    <h2>${xmlEscape(info.legal_name)} · NIF ${xmlEscape(info.tax_id || "—")} · Período ${dateFrom} a ${dateTo}</h2>
    <div class="warn"><strong>Aviso legal:</strong> GarageFlow não é software certificado pela AT. Este relatório serve apenas como apoio ao seu contabilista.</div>
    <table><thead><tr><th>Data</th><th>Tipo</th><th>Oficina/Cliente</th><th>NIF</th><th>Plano</th><th style="text-align:right">Valor</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="tot">
      <div><strong>Receita subscrições:</strong> €${totals.subsRevenue.toFixed(2)}</div>
      <div><strong>Comissões Marketplace:</strong> €${totals.marketCommissions.toFixed(2)}</div>
      <div style="margin-top:6px;font-size:15px"><strong>Total período:</strong> €${totals.total.toFixed(2)}</div>
    </div>
    <p style="color:#999;font-size:11px;margin-top:32px">Gerado em ${new Date().toLocaleString("pt-PT")}</p>
    <script>window.print();</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contabilidade GarageFlow</h1>
          <p className="text-muted-foreground text-sm mt-1">Exportações para o contabilista da plataforma</p>
        </div>
      </div>

      {/* Aviso legal */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-warning">Sistema não certificado pela AT</p>
          <p className="text-muted-foreground text-xs mt-1">
            As exportações desta página (CSV, PDF, SAF-T XML) têm carácter <strong>informativo</strong> e destinam-se apenas ao apoio da contabilidade interna da plataforma. Não substituem software de faturação certificado.
          </p>
        </div>
      </div>

      {/* Dados fiscais da plataforma */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Dados fiscais da empresa GarageFlow</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label className="text-xs">Nome legal</Label><Input value={info.legal_name} onChange={(e) => setInfo({ ...info, legal_name: e.target.value })} /></div>
          <div><Label className="text-xs">NIF</Label><Input value={info.tax_id || ""} onChange={(e) => setInfo({ ...info, tax_id: e.target.value })} /></div>
          <div><Label className="text-xs">País</Label><Input value={info.country} onChange={(e) => setInfo({ ...info, country: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Morada</Label><Input value={info.address || ""} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></div>
          <div><Label className="text-xs">Código Postal</Label><Input value={info.postal_code || ""} onChange={(e) => setInfo({ ...info, postal_code: e.target.value })} placeholder="0000-000" /></div>
          <div><Label className="text-xs">Cidade</Label><Input value={info.city || ""} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></div>
          <div><Label className="text-xs">IBAN</Label><Input value={info.iban || ""} onChange={(e) => setInfo({ ...info, iban: e.target.value })} /></div>
          <div><Label className="text-xs">Contabilista (nome)</Label><Input value={info.accountant_name || ""} onChange={(e) => setInfo({ ...info, accountant_name: e.target.value })} /></div>
          <div><Label className="text-xs">Contabilista (email)</Label><Input value={info.accountant_email || ""} onChange={(e) => setInfo({ ...info, accountant_email: e.target.value })} /></div>
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={saveInfo} disabled={savingInfo}>
            {savingInfo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Guardar
          </Button>
        </div>
      </section>

      {/* Filtros */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Período</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {(["month", "quarter", "year", "custom"] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
              {p === "month" ? "Mês" : p === "quarter" ? "Trimestre" : p === "year" ? "Ano" : "Personalizado"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPeriod("custom"); }} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPeriod("custom"); }} /></div>
          <div>
            <Label className="text-xs">Oficina</Label>
            <select className="w-full h-10 border border-input rounded-md bg-background px-3 text-sm"
              value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
              <option value="all">Todas as oficinas</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Subscrições Stripe</p>
          <p className="text-2xl font-bold mono mt-1">€{totals.subsRevenue.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">{subs.length} subscrições</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Comissões Marketplace</p>
          <p className="text-2xl font-bold mono mt-1">€{totals.marketCommissions.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">{escrows.length} transações</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-xl p-4 bg-primary/5">
          <p className="text-xs text-muted-foreground">Total período</p>
          <p className="text-2xl font-bold mono mt-1 text-primary">€{totals.total.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">{dateFrom} → {dateTo}</p>
        </div>
      </div>

      {/* Exportações */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Exportações</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}><FileDown className="w-4 h-4 mr-2" />CSV para contabilista</Button>
          <Button variant="outline" onClick={exportAccountantReport}><FileText className="w-4 h-4 mr-2" />Relatório imprimível (PDF)</Button>
          <Button variant="outline" onClick={exportSaftXml}><FileDown className="w-4 h-4 mr-2" />SAF-T PT (informativo)</Button>
        </div>
      </section>

      {/* Detalhe */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Detalhe do período</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.length === 0 && escrows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem movimentos no período</TableCell></TableRow>
                ) : (
                  <>
                    {subs.map((s) => {
                      const sh = shopById.get(s.shop_id);
                      const base = PLAN_PRICE_EUR[s.plan] || 0;
                      const factor = s.billing_cycle === "yearly" ? 12 : 1;
                      const disc = 1 - (Number(s.discount_percent) || 0) / 100;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="mono text-xs">{(s.created_at || "").slice(0, 10)}</TableCell>
                          <TableCell><Badge variant="secondary">Subscrição</Badge></TableCell>
                          <TableCell>{sh?.name || "—"}</TableCell>
                          <TableCell className="mono text-xs">{sh?.nif || "—"}</TableCell>
                          <TableCell>{s.plan} · {s.billing_cycle}</TableCell>
                          <TableCell className="text-right mono font-semibold">€{(base * factor * disc).toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {escrows.map((e) => {
                      const sh = shopById.get(e.seller_id);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="mono text-xs">{(e.captured_at || e.created_at || "").slice(0, 10)}</TableCell>
                          <TableCell><Badge variant="secondary" className="bg-primary/10 text-primary">Comissão</Badge></TableCell>
                          <TableCell>{sh?.name || "—"}</TableCell>
                          <TableCell className="mono text-xs">{sh?.nif || "—"}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell className="text-right mono font-semibold">€{Number(e.platform_fee || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
