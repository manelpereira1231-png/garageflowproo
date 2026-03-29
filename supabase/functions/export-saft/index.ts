import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(d: string): string {
  return d ? d.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function formatDateTime(d: string): string {
  if (!d) return new Date().toISOString();
  return d.replace(" ", "T").slice(0, 19);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { shop_id, year, start_date, end_date } = await req.json();
    if (!shop_id) {
      return new Response(JSON.stringify({ error: "shop_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fiscalYear = year || new Date().getFullYear();
    const periodStart = start_date || `${fiscalYear}-01-01`;
    const periodEnd = end_date || `${fiscalYear}-12-31`;

    // Fetch shop data
    const { data: shop } = await supabase
      .from("shops")
      .select("*")
      .eq("id", shop_id)
      .single();

    if (!shop) {
      return new Response(JSON.stringify({ error: "Shop not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoices in period
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("shop_id", shop_id)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd + "T23:59:59")
      .order("created_at", { ascending: true });

    // Fetch clients referenced by invoices
    const clientIds = [...new Set((invoices || []).map((i: any) => i.client_id))];
    const { data: clients } = clientIds.length > 0
      ? await supabase.from("clients").select("*").in("id", clientIds)
      : { data: [] };

    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

    // Fetch payments in period
    const invoiceIds = (invoices || []).map((i: any) => i.id);
    const { data: payments } = invoiceIds.length > 0
      ? await supabase.from("payments").select("*").in("invoice_id", invoiceIds)
      : { data: [] };

    const paymentsByInvoice = new Map<string, any[]>();
    (payments || []).forEach((p: any) => {
      const arr = paymentsByInvoice.get(p.invoice_id) || [];
      arr.push(p);
      paymentsByInvoice.set(p.invoice_id, arr);
    });

    // Build SAF-T XML (v1.04_01)
    const now = new Date().toISOString();
    const taxRegNumber = shop.nif || "000000000";

    // Product entries (from invoice items)
    const productSet = new Set<string>();
    (invoices || []).forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        productSet.add(item.description || "Serviço");
      });
    });
    const productXml = Array.from(productSet).map((desc, idx) => `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>SRV${String(idx + 1).padStart(3, '0')}</ProductCode>
        <ProductDescription>${escapeXml(desc)}</ProductDescription>
        <ProductNumberCode>SRV${String(idx + 1).padStart(3, '0')}</ProductNumberCode>
      </Product>`).join("");

    const productCodeMap = new Map<string, string>();
    Array.from(productSet).forEach((desc, idx) => {
      productCodeMap.set(desc, `SRV${String(idx + 1).padStart(3, '0')}`);
    });

    // Build customer entries
    const customerXml = (clients || []).map((c: any) => `
      <Customer>
        <CustomerID>${escapeXml(c.id)}</CustomerID>
        <AccountID>21</AccountID>
        <CustomerTaxID>${escapeXml(c.nif || "999999990")}</CustomerTaxID>
        <CompanyName>${escapeXml(c.company || c.name)}</CompanyName>
        <Contact>${escapeXml(c.name)}</Contact>
        <BillingAddress>
          <AddressDetail>${escapeXml("Consumidor Final")}</AddressDetail>
          <City>-</City>
          <PostalCode>0000-000</PostalCode>
          <Country>PT</Country>
        </BillingAddress>
        <Telephone>${escapeXml(c.phone || "")}</Telephone>
        <Email>${escapeXml(c.email || "")}</Email>
        <SelfBillingIndicator>0</SelfBillingIndicator>
      </Customer>`).join("");

    // Tax code mapping
    const getTaxCode = (rate: number): string => {
      if (rate === 0) return "ISE";
      if (rate === 6) return "RED";
      if (rate === 13) return "INT";
      return "NOR";
    };

    // Build invoice entries
    let totalDebit = 0;
    let totalCredit = 0;

    const invoiceXml = (invoices || []).map((inv: any) => {
      const lines = (inv.invoice_items || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const vatRate = Number(item.vat_rate) || 23;
        const lineNet = qty * unitPrice;
        const lineTax = lineNet * (vatRate / 100);
        const lineTotal = lineNet + lineTax;
        totalCredit += lineNet;
        const productCode = productCodeMap.get(item.description || "Serviço") || "SRV001";

        return `
          <Line>
            <LineNumber>${idx + 1}</LineNumber>
            <ProductCode>${productCode}</ProductCode>
            <ProductDescription>${escapeXml(item.description)}</ProductDescription>
            <Quantity>${qty}</Quantity>
            <UnitOfMeasure>UN</UnitOfMeasure>
            <UnitPrice>${unitPrice.toFixed(4)}</UnitPrice>
            <TaxPointDate>${formatDate(inv.created_at)}</TaxPointDate>
            <Description>${escapeXml(item.description)}</Description>
            <CreditAmount>${lineNet.toFixed(2)}</CreditAmount>
            <Tax>
              <TaxType>IVA</TaxType>
              <TaxCountryRegion>PT</TaxCountryRegion>
              <TaxCode>${getTaxCode(vatRate)}</TaxCode>
              <TaxPercentage>${vatRate}</TaxPercentage>
            </Tax>
            <SettlementAmount>0.00</SettlementAmount>
          </Line>`;
      }).join("");

      const invoiceStatus = inv.status === "cancelled" ? "A" : "N";
      const invPayments = paymentsByInvoice.get(inv.id) || [];
      const paymentsXml = invPayments.length > 0
        ? invPayments.map((p: any) => `
          <Payment>
            <PaymentMechanism>${p.method === 'card' ? 'CC' : p.method === 'transfer' ? 'TB' : p.method === 'mbway' ? 'MB' : 'NU'}</PaymentMechanism>
            <PaymentAmount>${Number(p.amount).toFixed(2)}</PaymentAmount>
            <PaymentDate>${formatDate(p.paid_at)}</PaymentDate>
          </Payment>`).join("")
        : "";

      return `
        <Invoice>
          <InvoiceNo>${escapeXml(inv.number)}</InvoiceNo>
          <ATCUD>0</ATCUD>
          <DocumentStatus>
            <InvoiceStatus>${invoiceStatus}</InvoiceStatus>
            <InvoiceStatusDate>${formatDateTime(inv.created_at)}</InvoiceStatusDate>
            <SourceID>${escapeXml(user.email || "GarageFlow")}</SourceID>
            <SourceBilling>P</SourceBilling>
          </DocumentStatus>
          <Hash>0</Hash>
          <HashControl>0</HashControl>
          <Period>${new Date(inv.created_at).getMonth() + 1}</Period>
          <InvoiceDate>${formatDate(inv.created_at)}</InvoiceDate>
          <InvoiceType>FT</InvoiceType>
          <SpecialRegimes>
            <SelfBillingIndicator>0</SelfBillingIndicator>
            <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
            <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
          </SpecialRegimes>
          <SourceID>${escapeXml(user.email || "GarageFlow")}</SourceID>
          <SystemEntryDate>${formatDateTime(inv.created_at)}</SystemEntryDate>
          <CustomerID>${escapeXml(inv.client_id)}</CustomerID>
          ${lines}
          <DocumentTotals>
            <TaxPayable>${(Number(inv.vat_total) || 0).toFixed(2)}</TaxPayable>
            <NetTotal>${(Number(inv.subtotal) || 0).toFixed(2)}</NetTotal>
            <GrossTotal>${(Number(inv.total) || 0).toFixed(2)}</GrossTotal>
            ${paymentsXml}
          </DocumentTotals>
        </Invoice>`;
    }).join("");

    // Collect distinct tax entries used
    const taxEntries = new Set<number>();
    (invoices || []).forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        taxEntries.add(Number(item.vat_rate) || 23);
      });
    });
    if (taxEntries.size === 0) taxEntries.add(Number(shop.vat_rate) || 23);

    const taxTableXml = Array.from(taxEntries).sort((a, b) => b - a).map(rate => {
      const code = getTaxCode(rate);
      const desc = rate === 0 ? "Isento" : rate === 6 ? "Taxa Reduzida" : rate === 13 ? "Taxa Intermédia" : "Taxa Normal";
      return `
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>${code}</TaxCode>
        <Description>${desc}</Description>
        <TaxPercentage>${rate}</TaxPercentage>
      </TaxTableEntry>`;
    }).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${escapeXml(taxRegNumber)}</CompanyID>
    <TaxRegistrationNumber>${escapeXml(taxRegNumber)}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXml(shop.name)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(shop.address || "Sem morada")}</AddressDetail>
      <City>-</City>
      <PostalCode>0000-000</PostalCode>
      <Country>PT</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${periodStart}</StartDate>
    <EndDate>${periodEnd}</EndDate>
    <CurrencyCode>${shop.currency || "EUR"}</CurrencyCode>
    <DateCreated>${formatDate(now)}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>999999990</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>GarageFlow</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <HeaderComment>Exportação fiscal (beta) — Documento gerado por sistema de gestão. Deve ser comunicado à Autoridade Tributária através de software certificado.</HeaderComment>
  </Header>
  <MasterFiles>
    ${productXml}
    ${customerXml}
    <TaxTable>
      ${taxTableXml}
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${(invoices || []).length}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>
      ${invoiceXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="SAFT-PT_${shop.nif || shop.name}_${fiscalYear}.xml"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
