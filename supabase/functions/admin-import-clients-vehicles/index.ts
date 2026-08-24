import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type IncomingRecord = {
  rowNumber: number;
  sheet: string;
  client: Record<string, string>;
  vehicle: Record<string, string>;
  service?: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

const normPlate = (v: string) => (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normName = (v: string) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const normPhone = (v: string) => (v || "").replace(/[^\d]/g, "").slice(-9);
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Impressão digital estável de uma intervenção, para nunca duplicar histórico. */
const serviceFingerprint = (date: string, description: string, total: number) =>
  `${date || "sd"}|${normName(description).slice(0, 60)}|${total.toFixed(2)}`;

/** Divide um campo livre de peças em itens ("Filtro óleo; Pastilhas x2"). */
const splitParts = (v: string): string[] =>
  str(v, 1000)
    .split(/[;\n|]+|,(?=\s*[A-Za-zÀ-ÿ])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1)
    .slice(0, 30);


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Sessão inválida" }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Sessão inválida" }, 401);
    const userId = userData.user.id;

    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userId)
      .in("role", ["super_admin", "admin", "commercial_admin"]);
    if (!roles || roles.length === 0) return json({ error: "Sem permissões para importar dados" }, 403);

    const body = await req.json().catch(() => null);
    const shopId = str(body?.shopId, 40);
    const dryRun = body?.dryRun === true;
    const records: IncomingRecord[] = Array.isArray(body?.records) ? body.records : [];
    if (!shopId || !/^[0-9a-f-]{36}$/i.test(shopId)) return json({ error: "Oficina inválida" }, 400);
    if (!records.length) return json({ error: "Nenhum registo recebido" }, 400);
    if (records.length > 2000) return json({ error: "Máximo de 2000 linhas por lote" }, 400);

    const { data: shop } = await admin.from("shops").select("id, name").eq("id", shopId).maybeSingle();
    if (!shop) return json({ error: "Oficina não encontrada" }, 404);

    // Estado atual da oficina (isolamento total por shop_id)
    const { data: existingClients } = await admin
      .from("clients").select("id, name, email, phone, nif").eq("shop_id", shopId).is("deleted_at", null);
    const { data: existingVehicles } = await admin
      .from("vehicles").select("id, plate, vin, client_id").eq("shop_id", shopId).is("deleted_at", null);

    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    const byNif = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const c of existingClients || []) {
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c.id);
      const ph = normPhone(String(c.phone || ""));
      if (ph.length >= 6) byPhone.set(ph, c.id);
      if (c.nif) byNif.set(String(c.nif).replace(/\s/g, ""), c.id);
      if (c.name) byName.set(normName(String(c.name)), c.id);
    }
    const byPlate = new Map<string, string>();
    const byVin = new Map<string, string>();
    for (const v of existingVehicles || []) {
      if (v.plate) byPlate.set(normPlate(String(v.plate)), v.id);
      if (v.vin) byVin.set(String(v.vin).toUpperCase(), v.id);
    }

    // Histórico já existente (nunca é apagado nem duplicado)
    const { data: existingOrders } = await admin
      .from("work_orders")
      .select("id, vehicle_id, created_at, client_description, total")
      .eq("shop_id", shopId);
    const orderFingerprints = new Set<string>();
    for (const o of existingOrders || []) {
      orderFingerprints.add(
        `${o.vehicle_id}::${serviceFingerprint(String(o.created_at || "").slice(0, 10), String(o.client_description || ""), num(o.total))}`,
      );
    }

    const results: {
      rowNumber: number; sheet: string; status: "imported" | "skipped" | "error";
      clientAction?: "created" | "matched"; vehicleAction?: "created" | "duplicate" | "none";
      serviceAction?: "created" | "duplicate" | "none"; partsCount?: number;
      message?: string;
    }[] = [];


    for (const rec of records) {
      const rowNumber = Number(rec?.rowNumber) || 0;
      const sheet = str(rec?.sheet, 80);
      const c = rec?.client || {};
      const v = rec?.vehicle || {};

      const name = str(c.name, 200);
      const email = EMAIL_RE.test(str(c.email, 200)) ? str(c.email, 200).toLowerCase() : "";
      const phone = str(c.phone, 40);
      const nif = str(c.nif, 30);
      const company = str(c.company, 200);
      const extraNotes = [c.address ? `Morada: ${str(c.address)}` : "", c.postal_code ? `CP: ${str(c.postal_code, 20)}` : "",
        c.city ? `Localidade: ${str(c.city, 100)}` : "", c.notes ? str(c.notes, 500) : ""].filter(Boolean).join(" | ");

      const plate = str(v.plate, 20).toUpperCase();
      const vin = VIN_RE.test(str(v.vin, 20)) ? str(v.vin, 20).toUpperCase() : null;
      const make = str(v.make, 80);
      const model = str(v.model, 120);
      const wantsVehicle = !!(plate || vin || make || model);

      const s = rec?.service || {};
      const svcDescription = str(s.description, 300);
      const svcDiagnosis = str(s.diagnosis, 1000);
      const svcWorkDone = str(s.work_done, 1000);
      const svcPartsRaw = str(s.parts, 1000);
      const svcTotal = s.total !== undefined && s.total !== "" ? num(s.total) : 0;
      const svcDate = /^\d{4}-\d{2}-\d{2}$/.test(str(s.date, 10)) ? str(s.date, 10) : "";
      const wantsService = !!(svcDescription || svcDiagnosis || svcWorkDone || svcPartsRaw || svcTotal || s.document || s.warranty);

      if (!name) { results.push({ rowNumber, sheet, status: "error", message: "Cliente sem nome" }); continue; }
      const plateKnown = !!plate && byPlate.has(normPlate(plate));
      if (wantsVehicle && (!plate || ((!make || !model) && !plateKnown))) {
        results.push({ rowNumber, sheet, status: "error", message: "Viatura incompleta (matrícula, marca e modelo obrigatórios)" });
        continue;
      }

      try {
        // 1) Cliente — reutiliza se já existir (nunca duplica em silêncio)
        let clientId =
          (email && byEmail.get(email)) ||
          (nif && byNif.get(nif)) ||
          (normPhone(phone).length >= 6 ? byPhone.get(normPhone(phone)) : undefined) ||
          byName.get(normName(name));
        let clientAction: "created" | "matched" = clientId ? "matched" : "created";

        if (!clientId) {
          if (dryRun) {
            clientId = `dry-${rowNumber}`;
          } else {
            const { data: inserted, error: cErr } = await admin.from("clients").insert({
              shop_id: shopId, name, phone, email,
              company: company || null, nif: nif || null, notes: extraNotes || null,
            }).select("id").single();
            if (cErr) throw new Error(cErr.message);
            clientId = inserted.id;
          }
          if (email) byEmail.set(email, clientId!);
          if (nif) byNif.set(nif, clientId!);
          if (normPhone(phone).length >= 6) byPhone.set(normPhone(phone), clientId!);
          byName.set(normName(name), clientId!);
        }

        // 2) Viatura — a mesma matrícula é sempre a mesma viatura
        let vehicleAction: "created" | "duplicate" | "none" = "none";
        let vehicleId: string | undefined;
        if (wantsVehicle) {
          const key = normPlate(plate);
          const existing = byPlate.get(key) || (vin ? byVin.get(vin) : undefined);
          if (existing) {
            vehicleAction = "duplicate";
            vehicleId = existing;
          } else {
            if (dryRun) {
              vehicleId = `dry-v-${rowNumber}`;
            } else {
              const { data: insertedV, error: vErr } = await admin.from("vehicles").insert({
                shop_id: shopId, client_id: clientId, make, model,
                version: str(v.version, 120) || null,
                year: Number(v.year) || new Date().getFullYear(),
                plate, vin, mileage: Number(v.mileage) || 0,
                fuel: str(v.fuel, 40) || "Gasolina",
                notes: str(v.notes, 500) || null,
              }).select("id").single();
              if (vErr) throw new Error(vErr.message);
              vehicleId = insertedV.id;
            }
            byPlate.set(key, vehicleId!);
            if (vin) byVin.set(vin, vehicleId!);
            vehicleAction = "created";
          }
        }

        // 3) Intervenção (histórico) — só quando o ficheiro a contém e a viatura é identificável
        let serviceAction: "created" | "duplicate" | "none" = "none";
        let partsCount = 0;
        if (wantsService && vehicleId) {
          const description = svcDescription || svcWorkDone || svcDiagnosis;
          const fp = `${vehicleId}::${serviceFingerprint(svcDate, description, svcTotal)}`;
          if (orderFingerprints.has(fp)) {
            serviceAction = "duplicate";
          } else {
            const partItems = splitParts(svcPartsRaw);
            partsCount = partItems.length;
            const lines = [
              ...(description
                ? [{ id: crypto.randomUUID(), type: "service", name: description.slice(0, 200), quantity: 1, unit_price: svcTotal, unit_cost: 0, vat_rate: 0 }]
                : []),
              ...partItems.map((p) => ({
                id: crypto.randomUUID(), type: "part", name: p.slice(0, 200),
                quantity: 1, unit_price: 0, unit_cost: 0, vat_rate: 0,
              })),
            ];
            const notes = [
              svcWorkDone && svcWorkDone !== description ? `Trabalho realizado: ${svcWorkDone}` : "",
              svcPartsRaw ? `Peças: ${svcPartsRaw}` : "",
              s.document ? `Documento: ${str(s.document, 120)}` : "",
              s.payment ? `Pagamento: ${str(s.payment, 120)}` : "",
              s.warranty ? `Garantia: ${str(s.warranty, 200)}` : "",
              s.technician ? `Técnico: ${str(s.technician, 120)}` : "",
              s.notes ? str(s.notes, 800) : "",
              "Registo importado do histórico da oficina",
            ].filter(Boolean).join(" | ");

            if (!dryRun) {
              const { data: numberData } = await admin.rpc("next_number", { _shop_id: shopId, _prefix: "SRV" });
              const number = numberData || `SRV-IMP-${Date.now()}-${rowNumber}`;
              const ts = svcDate ? new Date(`${svcDate}T12:00:00Z`).toISOString() : new Date().toISOString();
              const { error: wErr } = await admin.from("work_orders").insert({
                shop_id: shopId, number, origin: "manual",
                client_id: clientId, vehicle_id: vehicleId,
                entry_mileage: Number(s.mileage) || Number(v.mileage) || 0,
                client_description: description ? description.slice(0, 500) : null,
                diagnosis: svcDiagnosis || null,
                lines, labor_hours: 0,
                technician: str(s.technician, 120) || null,
                subtotal: svcTotal, vat_total: 0, total: svcTotal, cost_total: 0, profit: svcTotal,
                status: "delivered", notes,
                created_at: ts, completed_at: ts, delivered_at: ts,
              });
              if (wErr) throw new Error(wErr.message);
            }
            orderFingerprints.add(fp);
            serviceAction = "created";
          }
        } else if (wantsService && !vehicleId) {
          serviceAction = "none";
        }

        const somethingNew = clientAction === "created" || vehicleAction === "created" || serviceAction === "created";
        const parts: string[] = [
          clientAction === "created" ? "Cliente criado" : "Cliente existente",
          vehicleAction === "created" ? "Viatura criada" : vehicleAction === "duplicate" ? "Viatura existente" : "",
          serviceAction === "created"
            ? `1 intervenção importada${partsCount ? ` · ${partsCount} peça(s)` : ""}`
            : serviceAction === "duplicate" ? "Intervenção já existia" : "",
          wantsService && !vehicleId ? "Intervenção sem viatura identificável — não associada" : "",
        ].filter(Boolean);

        results.push({
          rowNumber, sheet,
          status: somethingNew ? "imported" : "skipped",
          clientAction, vehicleAction, serviceAction, partsCount,
          message: parts.join(" · "),
        });
      } catch (e) {
        results.push({ rowNumber, sheet, status: "error", message: (e as Error).message });
      }
    }

    const summary = {
      imported: results.filter((r) => r.status === "imported").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      clientsCreated: results.filter((r) => r.clientAction === "created" && r.status !== "error").length,
      vehiclesCreated: results.filter((r) => r.vehicleAction === "created" && r.status !== "error").length,
      duplicateVehicles: results.filter((r) => r.vehicleAction === "duplicate").length,
      servicesCreated: results.filter((r) => r.serviceAction === "created").length,
      duplicateServices: results.filter((r) => r.serviceAction === "duplicate").length,
      partsLinked: results.reduce((acc, r) => acc + (r.serviceAction === "created" ? (r.partsCount || 0) : 0), 0),
    };


    if (!dryRun) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "admin.import_clients_vehicles",
        entity_type: "shop",
        entity_id: shopId,
        details: { shop: shop.name, ...summary, total: records.length },
      }).then(({ error }) => { if (error) console.error("audit_logs insert failed", error.message); });
    }

    return json({ shopId, shopName: shop.name, dryRun, summary, results });
  } catch (e) {
    console.error("[ADMIN-IMPORT]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
