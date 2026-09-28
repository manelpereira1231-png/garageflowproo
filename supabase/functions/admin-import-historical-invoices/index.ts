/**
 * admin-import-historical-invoices
 * --------------------------------
 * Importação de faturas históricas para UMA oficina escolhida explicitamente
 * pelo super-admin. Todas as pesquisas (clientes, viaturas, duplicados) são
 * limitadas ao shop_id recebido e validado em CADA pedido.
 *
 * Ações:
 *   fetch_ix        → lê uma página de faturas da conta InvoiceXpress da oficina
 *   analyze         → classifica um lote (nada é gravado)
 *   start           → cria o registo da importação
 *   import          → grava um lote (idempotente)
 *   finish          → fecha o registo
 *   resolve_pending → associa manualmente uma fatura pendente a um cliente
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Item = { description: string; quantity: number; unit_price: number; vat_rate: number; total: number };
type Inv = {
  external_ref: string;
  source: "invoicexpress" | "csv";
  provider_invoice_id?: string | null;
  number: string;
  date: string | null;
  due_date?: string | null;
  status?: string | null;
  doc_type?: string | null;
  client_name?: string | null;
  client_nif?: string | null;
  client_email?: string | null;
  plate?: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  currency?: string | null;
  description?: string | null;
  items?: Item[];
  pdf_url?: string | null;
  permalink?: string | null;
  atcud?: string | null;
};

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[€\s]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const normNif = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 8 && d !== "999999990" ? d : "";
};
const normEmail = (v: unknown) => str(v).toLowerCase();
const normPlate = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const PLATE_RE = /\b([A-Z0-9]{2})[-\s]?([A-Z0-9]{2})[-\s]?([A-Z0-9]{2})\b/i;

/** dd/mm/yyyy | yyyy-mm-dd → yyyy-mm-dd */
function isoDate(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function sanitize(raw: any): Inv | null {
  const number = str(raw?.number, 80);
  const external_ref = str(raw?.external_ref, 120);
  if (!number || !external_ref) return null;
  const items: Item[] = Array.isArray(raw?.items)
    ? raw.items.slice(0, 200).map((i: any) => ({
      description: str(i?.description, 500) || "Linha",
      quantity: num(i?.quantity) || 1,
      unit_price: num(i?.unit_price),
      vat_rate: num(i?.vat_rate),
      total: num(i?.total),
    }))
    : [];
  return {
    external_ref,
    source: raw?.source === "invoicexpress" ? "invoicexpress" : "csv",
    provider_invoice_id: raw?.provider_invoice_id ? str(raw.provider_invoice_id, 60) : null,
    number,
    date: isoDate(raw?.date),
    due_date: isoDate(raw?.due_date),
    status: str(raw?.status, 40) || null,
    doc_type: str(raw?.doc_type, 60) || null,
    client_name: str(raw?.client_name, 200) || null,
    client_nif: str(raw?.client_nif, 30) || null,
    client_email: str(raw?.client_email, 200) || null,
    plate: str(raw?.plate, 20) || null,
    subtotal: num(raw?.subtotal),
    vat_total: num(raw?.vat_total),
    total: num(raw?.total),
    currency: str(raw?.currency, 5).toUpperCase() || "EUR",
    description: str(raw?.description, 2000) || null,
    items,
    pdf_url: str(raw?.pdf_url, 1000) || null,
    permalink: str(raw?.permalink, 1000) || null,
    atcud: str(raw?.atcud, 80) || null,
  };
}

/** Estado atual da oficina — tudo filtrado por shop_id. */
async function loadShopState(shopId: string) {
  const [clientsRes, vehiclesRes] = await Promise.all([
    admin.from("clients").select("id, name, email, nif").eq("shop_id", shopId).is("deleted_at", null).limit(50000),
    admin.from("vehicles").select("id, plate, client_id").eq("shop_id", shopId).is("deleted_at", null).limit(50000),
  ]);
  const byNif = new Map<string, string[]>();
  const byEmail = new Map<string, string[]>();
  for (const c of clientsRes.data ?? []) {
    const n = normNif(c.nif);
    if (n) byNif.set(n, [...(byNif.get(n) ?? []), c.id]);
    const e = normEmail(c.email);
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), c.id]);
  }
  const vehiclesByClient = new Map<string, { id: string; plate: string }[]>();
  for (const v of vehiclesRes.data ?? []) {
    if (!v.client_id) continue;
    vehiclesByClient.set(v.client_id, [...(vehiclesByClient.get(v.client_id) ?? []), { id: v.id, plate: normPlate(v.plate) }]);
  }
  return { byNif, byEmail, vehiclesByClient };
}

async function loadExisting(shopId: string, invs: Inv[]) {
  const refs = invs.map((i) => i.external_ref);
  const numbers = invs.map((i) => i.number);
  const pids = invs.map((i) => i.provider_invoice_id).filter(Boolean) as string[];
  const [a, b, c, d] = await Promise.all([
    admin.from("invoices").select("external_ref").eq("shop_id", shopId).in("external_ref", refs),
    admin.from("invoices").select("number, external_ref").eq("shop_id", shopId).in("number", numbers),
    pids.length
      ? admin.from("invoices").select("provider_invoice_id").eq("shop_id", shopId).eq("provider", "invoicexpress").in("provider_invoice_id", pids)
      : Promise.resolve({ data: [] as any[] }),
    admin.from("historical_invoice_pending").select("external_ref, resolved_invoice_id").eq("shop_id", shopId).in("external_ref", refs),
  ]);
  return {
    refs: new Set((a.data ?? []).map((r: any) => r.external_ref)),
    numbers: new Map((b.data ?? []).map((r: any) => [r.number, r.external_ref])),
    pids: new Set((c.data ?? []).map((r: any) => r.provider_invoice_id)),
    pending: new Map((d.data ?? []).map((r: any) => [r.external_ref, r.resolved_invoice_id])),
  };
}

type Verdict =
  | { kind: "duplicate"; reason: string }
  | { kind: "error"; reason: string }
  | { kind: "pending"; reason: string }
  | { kind: "new"; clientId: string; vehicleId: string | null; clientVia: string };

function classify(inv: Inv, st: Awaited<ReturnType<typeof loadShopState>>, ex: Awaited<ReturnType<typeof loadExisting>>): Verdict {
  if (ex.refs.has(inv.external_ref)) return { kind: "duplicate", reason: "Já importada" };
  if (inv.provider_invoice_id && ex.pids.has(inv.provider_invoice_id)) {
    return { kind: "duplicate", reason: "Já existe no GarageFlow (emitida pela oficina)" };
  }
  if (ex.numbers.has(inv.number)) {
    return { kind: "error", reason: `O número ${inv.number} já existe nesta oficina noutra fatura` };
  }
  if (!inv.date) return { kind: "error", reason: "Data inválida ou em falta" };
  if (!(inv.total > 0) && !(inv.items?.length)) return { kind: "error", reason: "Sem valor nem linhas" };

  let clientId: string | null = null;
  let via = "";
  const nif = normNif(inv.client_nif);
  if (nif) {
    const hits = st.byNif.get(nif) ?? [];
    if (hits.length === 1) { clientId = hits[0]; via = "NIF"; }
    else if (hits.length > 1) return { kind: "pending", reason: `Vários clientes com o NIF ${nif}` };
  }
  if (!clientId) {
    const email = normEmail(inv.client_email);
    if (email) {
      const hits = st.byEmail.get(email) ?? [];
      if (hits.length === 1) { clientId = hits[0]; via = "email"; }
      else if (hits.length > 1) return { kind: "pending", reason: `Vários clientes com o email ${email}` };
    }
  }
  if (!clientId) {
    return { kind: "pending", reason: nif || inv.client_email ? "Cliente não encontrado nesta oficina" : "Fatura sem NIF nem email do cliente" };
  }

  let vehicleId: string | null = null;
  const vs = st.vehiclesByClient.get(clientId) ?? [];
  let plate = normPlate(inv.plate);
  if (!plate && inv.description) {
    const m = inv.description.toUpperCase().match(PLATE_RE);
    if (m) plate = `${m[1]}${m[2]}${m[3]}`;
  }
  if (plate) {
    const hits = vs.filter((v) => v.plate === plate);
    if (hits.length === 1) vehicleId = hits[0].id;
  } else if (vs.length === 1 && inv.plate === undefined) {
    vehicleId = null; // nunca adivinhar
  }
  return { kind: "new", clientId, vehicleId, clientVia: via };
}

async function insertInvoice(shopId: string, importId: string | null, inv: Inv, clientId: string, vehicleId: string | null) {
  const { data, error } = await admin.from("invoices").insert({
    shop_id: shopId,
    client_id: clientId,
    vehicle_id: vehicleId,
    number: inv.number,
    type: "invoice",
    status: "historical",
    subtotal: inv.subtotal || Math.max(0, inv.total - inv.vat_total),
    vat_total: inv.vat_total,
    total: inv.total,
    currency: inv.currency || "EUR",
    due_date: inv.due_date || inv.date,
    notes: inv.description,
    created_at: inv.date ? `${inv.date}T12:00:00Z` : undefined,
    emitida_em: inv.date ? `${inv.date}T12:00:00Z` : null,
    provider: inv.source === "invoicexpress" ? "invoicexpress" : "import",
    provider_invoice_id: inv.source === "invoicexpress" ? inv.provider_invoice_id : null,
    provider_pdf_url: inv.pdf_url,
    provider_permalink: inv.permalink,
    atcud: inv.atcud,
    is_historical: true,
    historical_import_id: importId,
    external_ref: inv.external_ref,
    historical_meta: {
      original_status: inv.status,
      doc_type: inv.doc_type,
      client_name: inv.client_name,
      client_nif: inv.client_nif,
      client_email: inv.client_email,
      plate: inv.plate,
      source: inv.source,
    },
  }).select("id").single();
  if (error) throw new Error(error.message);
  if (inv.items?.length) {
    const { error: e2 } = await admin.from("invoice_items").insert(
      inv.items.map((i) => ({ invoice_id: data.id, ...i, total: i.total || i.quantity * i.unit_price })),
    );
    if (e2) {
      await admin.from("invoices").delete().eq("id", data.id);
      throw new Error(`Linhas: ${e2.message}`);
    }
  }
  return data.id as string;
}

async function ixFetch(base: string, path: string) {
  // Algumas contas respondem na raiz, outras sob /api — mesma lógica usada no resto do projeto.
  for (const prefix of ["", "/api"]) {
    const r = await fetch(`${base}${prefix}${path}`, { headers: { Accept: "application/json" } });
    if (r.ok) return await r.json();
    if (r.status !== 404) throw new Error(`InvoiceXpress HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  }
  throw new Error("InvoiceXpress: endpoint de listagem não encontrado");
}

function mapIx(d: any): Inv | null {
  if (!d?.id) return null;
  const st = String(d.status || "").toLowerCase();
  if (st === "draft" || st === "deleted") return null; // rascunhos não são faturas emitidas
  const number = str(d.inverted_sequence_number || d.sequence_number, 80);
  if (!number) return null;
  const items: Item[] = (d.items ?? []).map((i: any) => ({
    description: str(i?.description || i?.name, 500) || "Linha",
    quantity: num(i?.quantity) || 1,
    unit_price: num(i?.unit_price),
    vat_rate: num(i?.tax?.value),
    total: num(i?.total) || num(i?.subtotal) || num(i?.quantity) * num(i?.unit_price),
  }));
  const text = [d.observations, d.reference, ...(d.items ?? []).map((i: any) => i?.description)].filter(Boolean).join(" ");
  return sanitize({
    external_ref: `ix:${d.id}`,
    source: "invoicexpress",
    provider_invoice_id: String(d.id),
    number,
    date: d.date,
    due_date: d.due_date,
    status: d.status,
    doc_type: d.type,
    client_name: d.client?.name,
    client_nif: d.client?.fiscal_id,
    client_email: d.client?.email,
    subtotal: num(d.sum) - num(d.discount),
    vat_total: num(d.taxes),
    total: num(d.total),
    currency: d.currency_code || "EUR",
    description: text,
    items,
    pdf_url: d.public_pdf_url || null,
    permalink: d.permalink || null,
    atcud: d.atcud || null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Sessão inválida" }, 401);
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const { data: isSA } = await admin.rpc("is_super_admin", { _user_id: user.id });
    if (isSA !== true) return json({ error: "Apenas o administrador GarageFlow" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // resolve_pending valida a oficina a partir do próprio registo pendente.
    if (action === "resolve_pending") {
      const { data: p } = await admin.from("historical_invoice_pending").select("*").eq("id", str(body.pendingId, 40)).maybeSingle();
      if (!p) return json({ error: "Pendente não encontrada" }, 404);
      if (p.resolved_invoice_id) return json({ ok: true, invoiceId: p.resolved_invoice_id });
      const { data: c } = await admin.from("clients").select("id, shop_id").eq("id", str(body.clientId, 40)).maybeSingle();
      if (!c || c.shop_id !== p.shop_id) return json({ error: "Cliente não pertence a esta oficina" }, 400);
      let vehicleId: string | null = null;
      if (body.vehicleId) {
        const { data: v } = await admin.from("vehicles").select("id, shop_id, client_id").eq("id", str(body.vehicleId, 40)).maybeSingle();
        if (!v || v.shop_id !== p.shop_id || v.client_id !== c.id) return json({ error: "Viatura não pertence a este cliente" }, 400);
        vehicleId = v.id;
      }
      const inv = sanitize(p.payload);
      if (!inv) return json({ error: "Dados da fatura inválidos" }, 400);
      const ex = await loadExisting(p.shop_id, [inv]);
      if (ex.refs.has(inv.external_ref)) return json({ error: "Esta fatura já foi importada" }, 409);
      if (ex.numbers.has(inv.number)) return json({ error: `O número ${inv.number} já existe nesta oficina` }, 409);
      const id = await insertInvoice(p.shop_id, p.import_id, inv, c.id, vehicleId);
      await admin.from("historical_invoice_pending").update({ resolved_invoice_id: id, resolved_at: new Date().toISOString() }).eq("id", p.id);
      return json({ ok: true, invoiceId: id });
    }

    if (action === "finish") {
      const { error } = await admin.from("historical_invoice_imports").update({
        status: str(body.status, 20) || "completed",
        finished_at: new Date().toISOString(),
      }).eq("id", str(body.importId, 40));
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    const shopId = str(body.shopId, 40);
    if (!/^[0-9a-f-]{36}$/i.test(shopId)) return json({ error: "Oficina inválida" }, 400);
    const { data: shop } = await admin.from("shops").select("id, name").eq("id", shopId).maybeSingle();
    if (!shop) return json({ error: "Oficina não encontrada" }, 404);

    if (action === "ix_status") {
      const { data: integ } = await admin.from("integracao_faturacao")
        .select("account_name, ativo, api_key_encrypted").eq("shop_id", shopId).eq("provider", "invoicexpress").maybeSingle();
      return json({ ok: true, connected: !!(integ?.account_name && integ?.api_key_encrypted), account: integ?.account_name ?? null });
    }

    if (action === "fetch_ix") {
      const { data: integ } = await admin.from("integracao_faturacao")
        .select("account_name, api_key_encrypted").eq("shop_id", shopId).eq("provider", "invoicexpress").maybeSingle();
      if (!integ?.account_name || !integ?.api_key_encrypted) {
        return json({ error: "Esta oficina não tem o InvoiceXpress ligado. Use a opção CSV/Excel." }, 400);
      }
      const apiKey = await decryptSecret(integ.api_key_encrypted);
      const page = Math.max(1, Number(body.page) || 1);
      const base = `https://${integ.account_name}.app.invoicexpress.com`;
      const j = await ixFetch(base, `/invoices.json?api_key=${encodeURIComponent(apiKey)}&page=${page}&per_page=50`);
      const list = (j?.invoices ?? []) as any[];
      const invoices = list.map(mapIx).filter(Boolean);
      return json({
        ok: true,
        invoices,
        skipped_drafts: list.length - invoices.length,
        page,
        total_pages: Number(j?.pagination?.total_pages) || 1,
        total_entries: Number(j?.pagination?.total_entries) || list.length,
      });
    }

    const raw: any[] = Array.isArray(body.invoices) ? body.invoices : [];
    if (raw.length > 200) return json({ error: "Máximo de 200 faturas por lote" }, 400);
    const invs: Inv[] = [];
    const invalid: { number: string; reason: string }[] = [];
    for (const r of raw) {
      const s = sanitize(r);
      if (s) invs.push(s);
      else invalid.push({ number: str(r?.number, 80) || "(sem número)", reason: "Sem número de fatura" });
    }

    if (action === "analyze") {
      const st = await loadShopState(shopId);
      const ex = invs.length ? await loadExisting(shopId, invs) : null;
      const rows = invs.map((inv) => {
        const v = classify(inv, st, ex!);
        return { external_ref: inv.external_ref, number: inv.number, date: inv.date, total: inv.total, client_name: inv.client_name, ...v };
      });
      return json({ ok: true, rows, invalid });
    }

    if (action === "start") {
      const { data, error } = await admin.from("historical_invoice_imports").insert({
        shop_id: shopId, shop_name: shop.name, admin_id: user.id, admin_email: user.email,
        source: str(body.source, 20) || "csv", found: Math.max(0, Number(body.found) || 0),
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, importId: data.id });
    }

    if (action === "import") {
      const importId = str(body.importId, 40);
      const { data: log } = await admin.from("historical_invoice_imports").select("*").eq("id", importId).maybeSingle();
      if (!log || log.shop_id !== shopId) return json({ error: "Importação não pertence a esta oficina" }, 400);

      const st = await loadShopState(shopId);
      const ex = invs.length ? await loadExisting(shopId, invs) : null;
      const c = { imported: 0, duplicates: 0, pending: 0, errors: invalid.length, clients: 0, vehicles: 0 };
      const errs: { number: string; reason: string }[] = [...invalid];
      for (const inv of invs) {
        const v = classify(inv, st, ex!);
        try {
          if (v.kind === "duplicate") c.duplicates++;
          else if (v.kind === "error") { c.errors++; errs.push({ number: inv.number, reason: v.reason }); }
          else if (v.kind === "pending") {
            if (ex!.pending.has(inv.external_ref)) { c.pending++; continue; }
            await admin.from("historical_invoice_pending").upsert({
              import_id: importId, shop_id: shopId, external_ref: inv.external_ref, payload: inv, reason: v.reason,
            }, { onConflict: "shop_id,external_ref", ignoreDuplicates: true });
            c.pending++;
          } else {
            await insertInvoice(shopId, importId, inv, v.clientId, v.vehicleId);
            ex!.refs.add(inv.external_ref);
            ex!.numbers.set(inv.number, inv.external_ref);
            c.imported++; c.clients++; if (v.vehicleId) c.vehicles++;
          }
        } catch (e) {
          const m = (e as Error).message;
          if (/duplicate key/i.test(m)) c.duplicates++;
          else { c.errors++; errs.push({ number: inv.number, reason: m.slice(0, 200) }); }
        }
      }
      await admin.from("historical_invoice_imports").update({
        imported: log.imported + c.imported,
        duplicates: log.duplicates + c.duplicates,
        pending: log.pending + c.pending,
        errors: log.errors + c.errors,
        clients_matched: log.clients_matched + c.clients,
        vehicles_matched: log.vehicles_matched + c.vehicles,
        error_details: [...(log.error_details ?? []), ...errs].slice(0, 1000),
      }).eq("id", importId);
      return json({ ok: true, ...c, error_list: errs });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[admin-import-historical-invoices]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
