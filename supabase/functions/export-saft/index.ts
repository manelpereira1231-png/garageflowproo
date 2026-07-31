import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

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

/** Extract city and postal code from address string */
function parseAddress(address: string | null): { detail: string; city: string; postalCode: string } {
  if (!address || !address.trim()) {
    return { detail: "Sem morada", city: "-", postalCode: "0000-000" };
  }
  const ptPostalMatch = address.match(/(\d{4}-\d{3})/);
  const postalCode = ptPostalMatch ? ptPostalMatch[1] : "0000-000";
  const parts = address.split(",").map(p => p.trim());
  let city = "-";
  if (parts.length >= 2) {
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
  let activeJobId: string | null = null;
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

    const requestBody = await req.json();
    const { shop_id, year, start_date, end_date, action = "enqueue", job_id } = requestBody;
    if (!shop_id) {
      return new Response(JSON.stringify({ error: "shop_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 Ownership check — user must belong to the requested shop, OR be super_admin.
    // Without this, any authenticated user could export ANY shop's SAF-T (fiscal PII).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const [{ data: idsRes }, { data: isAdminRes }] = await Promise.all([
      admin.rpc("get_user_shop_ids", { _user_id: user.id }),
      admin.rpc("is_super_admin", { _user_id: user.id }).catch(() => ({ data: false })),
    ]);
    const shopIds: string[] = Array.isArray(idsRes) ? idsRes.map((r: any) => r.get_user_shop_ids ?? r) : [];
    const isSuperAdmin = !!isAdminRes;
    if (!isSuperAdmin && !shopIds.includes(shop_id)) {
      return new Response(JSON.stringify({ error: "Forbidden — não tem acesso a esta oficina" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enqueue") {
      const fiscalYear = Number(year || new Date().getFullYear());
      const { data: job, error: jobError } = await admin
        .from("saft_export_jobs")
        .insert({
          shop_id,
          requested_by: user.id,
          fiscal_year: fiscalYear,
          status: "queued",
          progress: 0,
        })
        .select("id")
        .single();

      if (jobError || !job) throw jobError || new Error("Não foi possível criar a exportação SAF-T");

      const workerRequest = fetch(req.url, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...requestBody,
          action: "process",
          job_id: job.id,
          year: fiscalYear,
        }),
      }).catch(async (error) => {
        await admin.from("saft_export_jobs").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Falha ao iniciar geração",
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
      });
      EdgeRuntime.waitUntil(workerRequest);

      return new Response(JSON.stringify({ job_id: job.id, status: "queued" }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "process" || !job_id) {
      return new Response(JSON.stringify({ error: "Invalid export action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    activeJobId = job_id;
    const { data: exportJob } = await admin
      .from("saft_export_jobs")
      .select("id, requested_by, shop_id")
      .eq("id", job_id)
      .eq("shop_id", shop_id)
      .maybeSingle();
    if (!exportJob || exportJob.requested_by !== user.id) {
      return new Response(JSON.stringify({ error: "Export job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await admin.from("saft_export_jobs").update({
      status: "processing",
      progress: 10,
      started_at: new Date().toISOString(),
    }).eq("id", job_id);

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

    // Fetch quotes in period (for WorkingDocuments)
    const { data: quotes } = await supabase
      .from("quotes")
      .select("*")
      .eq("shop_id", shop_id)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd + "T23:59:59")
      .order("created_at", { ascending: true });

    // Fetch clients referenced by invoices and quotes
    const invoiceClientIds = (invoices || []).map((i: any) => i.client_id);
    const quoteClientIds = (quotes || []).map((q: any) => q.client_id);
    const allClientIds = [...new Set([...invoiceClientIds, ...quoteClientIds])];
    const { data: clients } = allClientIds.length > 0
      ? await supabase.from("clients").select("*").in("id", allClientIds)
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
    const taxRegNumber = shop.nif || "999999990";
    const shopCountryISO = countryToISO(shop.country);
    const shopAddress = parseAddress(shop.address);

    // Invoice type mapping
    function getInvoiceType(invType: string): string {
      switch (invType) {
        case "credit_note": return "NC";
        case "debit_note": return "ND";
        case "receipt": return "FR";
        default: return "FT";
      }
    }

    // Product entries (deduplicated by description)
    const productSet = new Map<string, string>();
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
    // Also add products from quote lines
    (quotes || []).forEach((q: any) => {
      const lines = Array.isArray(q.lines) ? q.lines : [];
      lines.forEach((line: any) => {
        const desc = line.name || line.description || "Serviço";
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

    // Build customer entries with real address data
    const customerXml = (clients || []).map((c: any) => {
      const hasNif = c.nif && c.nif.trim() !== "";
      const customerTaxId = hasNif ? c.nif : "999999990";
      // Use client company/name as address detail (clients table has no address field)
      const addressDetail = c.company || c.name || "Consumidor Final";
      return `
      <Customer>
        <CustomerID>${escapeXml(c.id)}</CustomerID>
        <AccountID>21</AccountID>
        <CustomerTaxID>${escapeXml(customerTaxId)}</CustomerTaxID>
        <CompanyName>${escapeXml(c.company || c.name)}</CompanyName>
        <Contact>${escapeXml(c.name)}</Contact>
        <BillingAddress>
          <AddressDetail>${escapeXml(addressDetail)}</AddressDetail>
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
      return "NOR";
    };

    // Build invoice entries
    let totalDebit = 0;
    let totalCredit = 0;

    const invoiceXml = (invoices || []).map((inv: any) => {
      const invType = getInvoiceType(inv.type || "invoice");
      const isCreditNote = invType === "NC";

      const lines = (inv.invoice_items || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const vatRate = Number(item.vat_rate) || 23;
        const lineNet = qty * unitPrice;

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

      const getPaymentMechanism = (method: string): string => {
        switch (method) {
          case "card": return "CC";
          case "transfer": return "TB";
          case "mbway": case "multibanco": return "MB";
          case "check": return "CH";
          case "cash": return "NU";
          default: return "OU";
        }
      };

      const paymentsXml = invPayments.map((p: any) => `
          <Payment>
            <PaymentMechanism>${getPaymentMechanism(p.method)}</PaymentMechanism>
            <PaymentAmount>${Number(p.amount).toFixed(2)}</PaymentAmount>
            <PaymentDate>${formatDate(p.paid_at)}</PaymentDate>
          </Payment>`).join("");

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

    // WorkingDocuments — quotes/estimates (ORC = Orçamento)
    const workingDocsXml = (quotes || []).map((q: any) => {
      const qLines = Array.isArray(q.lines) ? q.lines : [];
      const qStatus = q.status === "rejected" ? "A" : q.status === "approved" || q.status === "converted" ? "F" : "N";
      
      const linesXml = qLines.map((line: any, idx: number) => {
        const qty = Number(line.quantity) || 1;
        const unitPrice = Number(line.unit_price) || 0;
        const vatRate = Number(line.vat_rate) || 23;
        const lineNet = qty * unitPrice;
        const productCode = productSet.get(line.name || line.description || "Serviço") || "SRV001";

        return `
            <Line>
              <LineNumber>${idx + 1}</LineNumber>
              <ProductCode>${productCode}</ProductCode>
              <ProductDescription>${escapeXml(line.name || line.description || "Serviço")}</ProductDescription>
              <Quantity>${qty}</Quantity>
              <UnitOfMeasure>UN</UnitOfMeasure>
              <UnitPrice>${unitPrice.toFixed(4)}</UnitPrice>
              <TaxPointDate>${formatDate(q.created_at)}</TaxPointDate>
              <Description>${escapeXml(line.name || line.description || "Serviço")}</Description>
              <CreditAmount>${lineNet.toFixed(2)}</CreditAmount>
              <Tax>
                <TaxType>IVA</TaxType>
                <TaxCountryRegion>${shopCountryISO}</TaxCountryRegion>
                <TaxCode>${getTaxCode(vatRate)}</TaxCode>
                <TaxPercentage>${vatRate}</TaxPercentage>
              </Tax>
            </Line>`;
      }).join("");

      return `
          <WorkDocument>
            <DocumentNumber>${escapeXml(q.number)}</DocumentNumber>
            <ATCUD>0</ATCUD>
            <DocumentStatus>
              <WorkStatus>${qStatus}</WorkStatus>
              <WorkStatusDate>${formatDateTime(q.created_at)}</WorkStatusDate>
              <SourceID>${escapeXml(user.email || "GarageFlow")}</SourceID>
              <SourceBilling>P</SourceBilling>
            </DocumentStatus>
            <Hash>0</Hash>
            <HashControl>0</HashControl>
            <WorkDate>${formatDate(q.date || q.created_at)}</WorkDate>
            <WorkType>ORC</WorkType>
            <SourceID>${escapeXml(user.email || "GarageFlow")}</SourceID>
            <SystemEntryDate>${formatDateTime(q.created_at)}</SystemEntryDate>
            <CustomerID>${escapeXml(q.client_id)}</CustomerID>
            ${linesXml}
            <DocumentTotals>
              <TaxPayable>${(Number(q.vat_total) || 0).toFixed(2)}</TaxPayable>
              <NetTotal>${(Number(q.subtotal) || 0).toFixed(2)}</NetTotal>
              <GrossTotal>${(Number(q.total) || 0).toFixed(2)}</GrossTotal>
            </DocumentTotals>
          </WorkDocument>`;
    }).join("");

    // Tax table entries
    const taxEntries = new Set<number>();
    (invoices || []).forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        taxEntries.add(Number(item.vat_rate) || 23);
      });
    });
    (quotes || []).forEach((q: any) => {
      const lines = Array.isArray(q.lines) ? q.lines : [];
      lines.forEach((line: any) => {
        taxEntries.add(Number(line.vat_rate) || 23);
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
    <WorkingDocuments>
      <NumberOfEntries>${(quotes || []).length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${(quotes || []).reduce((s: number, q: any) => s + (Number(q.subtotal) || 0), 0).toFixed(2)}</TotalCredit>
      ${workingDocsXml}
    </WorkingDocuments>
  </SourceDocuments>
</AuditFile>`;

    const safeShopName = String(shop.nif || shop.name || shop_id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `SAFT-PT_${safeShopName}_${fiscalYear}.xml`;
    const storagePath = `${shop_id}/${job_id}/${filename}`;
    const { error: uploadError } = await admin.storage
      .from("saft-exports")
      .upload(storagePath, new Blob([xml], { type: "application/xml; charset=utf-8" }), {
        contentType: "application/xml; charset=utf-8",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    await admin.from("saft_export_jobs").update({
      status: "completed",
      progress: 100,
      storage_path: storagePath,
      filename,
      completed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", job_id);

    return new Response(JSON.stringify({ job_id, status: "completed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (activeJobId) {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await admin.from("saft_export_jobs").update({
          status: "failed",
          error_message: (err as Error).message || "Erro ao gerar SAF-T",
          completed_at: new Date().toISOString(),
        }).eq("id", activeJobId);
      } catch { /* best effort */ }
    }
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});