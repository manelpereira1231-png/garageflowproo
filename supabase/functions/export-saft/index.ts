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

/** Map country name to ISO 3166-1 alpha-2 */
function countryToISO(country: string): string {
  const map: Record<string, string> = {
    "Portugal": "PT", "Espanha": "ES", "España": "ES", "Spain": "ES",
    "França": "FR", "France": "FR", "Brasil": "BR", "Brazil": "BR",
    "United Kingdom": "GB", "Germany": "DE", "Alemanha": "DE",
    "Italy": "IT", "Itália": "IT", "Angola": "AO", "Moçambique": "MZ",
  };
  return map[country] || country?.slice(0, 2).toUpperCase() || "PT";
}

/** Try to extract city and postal code from address string */
function parseAddress(address: string | null): { detail: string; city: string; postalCode: string } {
  if (!address || !address.trim()) {
    return { detail: "Sem morada", city: "-", postalCode: "0000-000" };
  }
  // Try to match Portuguese postal code pattern: XXXX-XXX
  const ptPostalMatch = address.match(/(\d{4}-\d{3})/);
  const postalCode = ptPostalMatch ? ptPostalMatch[1] : "0000-000";

  // Try to extract city: typically after postal code or last comma-separated segment
  const parts = address.split(",").map(p => p.trim());
  let city = "-";
  if (parts.length >= 2) {
    // Last non-empty part after removing postal code
    const lastPart = parts[parts.length - 1].replace(/\d{4}-\d{3}/, "").trim();
    if (lastPart) city = lastPart;
    else if (parts.length >= 3) city = parts[parts.length - 2].trim();
  }

  return { detail: address, city, postalCode };
}

// TODO: AT validation — SAF-T hash chain requires AT-certified software.
// TODO: production compliance review — ATCUD generation requires AT registration.
// TODO: AT validation — SoftwareCertificateNumber must be obtained from AT.

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

    const now = new Date().toISOString();
    const taxRegNumber = shop.nif || "000000000";
    const shopCountryISO = countryToISO(shop.country);
    const shopAddress = parseAddress(shop.address);

    // Determine SAF-T InvoiceType based on invoice.type field
    // FT = Fatura, NC = Nota de Crédito, ND = Nota de Débito, FR = Fatura-Recibo
    function getInvoiceType(invType: string): string {
      switch (invType) {
        case "credit_note": return "NC";
        case "debit_note": return "ND";
        case "receipt": return "FR";
        default: return "FT";
      }
    }

    // Product entries (from invoice items — deduplicated by description)
    const productSet = new Map<string, string>(); // description -> code
    let productIdx = 0;
    (invoices || []).forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        const desc = item.description || "Serviço";
        if (!productSet.has(desc)) {
          productIdx++;
          productSet.set(desc, `SRV${String(productIdx).padStart(3, '0')}`);
        }
      });
    });

    const productXml = Array.from(productSet.entries()).map(([desc, code]) => `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>${code}</ProductCode>
        <ProductDescription>${escapeXml(desc)}</ProductDescription>
        <ProductNumberCode>${code}</ProductNumberCode>
      </Product>`).join("");

    // Build customer entries
    const customerXml = (clients || []).map((c: any) => {
      const hasNif = c.nif && c.nif.trim() !== "";
      return `
      <Customer>
        <CustomerID>${escapeXml(c.id)}</CustomerID>
        <AccountID>21</AccountID>
        <CustomerTaxID>${escapeXml(hasNif ? c.nif : "999999990")}</CustomerTaxID>
        <CompanyName>${escapeXml(c.company || c.name)}</CompanyName>
        <Contact>${escapeXml(c.name)}</Contact>
        <BillingAddress>
          <AddressDetail>${escapeXml(hasNif ? (c.company || c.name) : "Consumidor Final")}</AddressDetail>
          <City>-</City>
          <PostalCode>0000-000</PostalCode>
          <Country>${shopCountryISO}</Country>
        </BillingAddress>
        <Telephone>${escapeXml(c.phone || "")}</Telephone>
        <Email>${escapeXml(c.email || "")}</Email>
        <SelfBillingIndicator>0</SelfBillingIndicator>
      </Customer>`;
    }).join("");

    // Tax code mapping (PT standard rates)
    const getTaxCode = (rate: number): string => {
      if (rate === 0) return "ISE";
      if (rate === 6) return "RED";
      if (rate === 13) return "INT";
      return "NOR"; // 23% standard
    };

    // Build invoice entries — calculate real totals
    let totalDebit = 0;
    let totalCredit = 0;

    const invoiceXml = (invoices || []).map((inv: any, invIdx: number) => {
      const invType = getInvoiceType(inv.type || "invoice");
      const isCreditNote = invType === "NC";

      const lines = (inv.invoice_items || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const vatRate = Number(item.vat_rate) || 23;
        const lineNet = qty * unitPrice;

        // Credit notes use DebitAmount, invoices use CreditAmount
        if (isCreditNote) {
          totalDebit += lineNet;
        } else {
          totalCredit += lineNet;
        }

        const productCode = productSet.get(item.description || "Serviço") || "SRV001";
        const amountTag = isCreditNote
          ? `<DebitAmount>${lineNet.toFixed(2)}</DebitAmount>`
          : `<CreditAmount>${lineNet.toFixed(2)}</CreditAmount>`;

        return `
          <Line>
            <LineNumber>${idx + 1}</LineNumber>
            <ProductCode>${productCode}</ProductCode>
            <ProductDescription>${escapeXml(item.description || "Serviço")}</ProductDescription>
            <Quantity>${qty}</Quantity>
            <UnitOfMeasure>UN</UnitOfMeasure>
            <UnitPrice>${unitPrice.toFixed(4)}</UnitPrice>
            <TaxPointDate>${formatDate(inv.created_at)}</TaxPointDate>
            <Description>${escapeXml(item.description || "Serviço")}</Description>
            ${amountTag}
            <Tax>
              <TaxType>IVA</TaxType>
              <TaxCountryRegion>${shopCountryISO}</TaxCountryRegion>
              <TaxCode>${getTaxCode(vatRate)}</TaxCode>
              <TaxPercentage>${vatRate}</TaxPercentage>
            </Tax>
          </Line>`;
      }).join("");

      const invoiceStatus = inv.status === "cancelled" ? "A" : "N";
      const invPayments = paymentsByInvoice.get(inv.id) || [];

      // Payment mechanism mapping
      const getPaymentMechanism = (method: string): string => {
        switch (method) {
          case "card": return "CC";
          case "transfer": return "TB";
          case "mbway": return "MB";
          case "multibanco": return "MB";
          case "check": return "CH";
          case "cash": return "NU"; // Numerário
          default: return "OU"; // Outros
        }
      };

      const paymentsXml = invPayments.length > 0
        ? invPayments.map((p: any) => `
          <Payment>
            <PaymentMechanism>${getPaymentMechanism(p.method)}</PaymentMechanism>
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
          <InvoiceType>${invType}</InvoiceType>
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

    // Tax table entries
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
        <TaxCountryRegion>${shopCountryISO}</TaxCountryRegion>
        <TaxCode>${code}</TaxCode>
        <Description>${desc}</Description>
        <TaxPercentage>${rate}</TaxPercentage>
      </TaxTableEntry>`;
    }).join("");

    // TODO: AT validation — Hash chain (Hash/HashControl) requires AT software certification.
    // TODO: AT validation — ATCUD series requires registration with AT portal.
    // TODO: production compliance review — SoftwareCertificateNumber must be obtained from AT.

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${escapeXml(taxRegNumber)}</CompanyID>
    <TaxRegistrationNumber>${escapeXml(taxRegNumber)}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXml(shop.name)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(shopAddress.detail)}</AddressDetail>
      <City>${escapeXml(shopAddress.city)}</City>
      <PostalCode>${escapeXml(shopAddress.postalCode)}</PostalCode>
      <Country>${shopCountryISO}</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${periodStart}</StartDate>
    <EndDate>${periodEnd}</EndDate>
    <CurrencyCode>${shop.currency || "EUR"}</CurrencyCode>
    <DateCreated>${formatDate(now)}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${escapeXml(taxRegNumber)}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>GarageFlow</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <HeaderComment>Exportação fiscal operacional — Requer validação por software certificado pela AT antes de submissão oficial. Hash/ATCUD não implementados.</HeaderComment>
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
    <MovementOfGoods>
      <NumberOfMovementLines>0</NumberOfMovementLines>
      <TotalQuantityIssued>0.00</TotalQuantityIssued>
    </MovementOfGoods>
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
