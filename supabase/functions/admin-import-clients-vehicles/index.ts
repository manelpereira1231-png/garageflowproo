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
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

const normPlate = (v: string) => (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normName = (v: string) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const normPhone = (v: string) => (v || "").replace(/[^\d]/g, "").slice(-9);
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

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

    const results: {
      rowNumber: number; sheet: string; status: "imported" | "skipped" | "error";
      clientAction?: "created" | "matched"; vehicleAction?: "created" | "duplicate" | "none";
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

      if (!name) { results.push({ rowNumber, sheet, status: "error", message: "Cliente sem nome" }); continue; }
      if (wantsVehicle && (!plate || !make || !model)) {
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

        // 2) Viatura
        let vehicleAction: "created" | "duplicate" | "none" = "none";
        if (wantsVehicle) {
          const key = normPlate(plate);
          const existing = byPlate.get(key) || (vin ? byVin.get(vin) : undefined);
          if (existing) {
            vehicleAction = "duplicate";
          } else {
            if (!dryRun) {
              const { error: vErr } = await admin.from("vehicles").insert({
                shop_id: shopId, client_id: clientId, make, model,
                version: str(v.version, 120) || null,
                year: Number(v.year) || new Date().getFullYear(),
                plate, vin, mileage: Number(v.mileage) || 0,
                fuel: str(v.fuel, 40) || "Gasolina",
                notes: str(v.notes, 500) || null,
              });
              if (vErr) throw new Error(vErr.message);
            }
            byPlate.set(key, `new-${rowNumber}`);
            if (vin) byVin.set(vin, `new-${rowNumber}`);
            vehicleAction = "created";
          }
        }

        const skipped = clientAction === "matched" && vehicleAction !== "created";
        results.push({
          rowNumber, sheet,
          status: skipped ? "skipped" : "imported",
          clientAction, vehicleAction,
          message: skipped
            ? (vehicleAction === "duplicate" ? "Cliente e viatura já existiam" : "Cliente já existia")
            : undefined,
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
    };

    if (!dryRun) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "admin.import_clients_vehicles",
        entity_type: "shop",
        entity_id: shopId,
        metadata: { shop: shop.name, ...summary, total: records.length },
      }).then(({ error }) => { if (error) console.error("audit_logs insert failed", error.message); });
    }

    return json({ shopId, shopName: shop.name, dryRun, summary, results });
  } catch (e) {
    console.error("[ADMIN-IMPORT]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
