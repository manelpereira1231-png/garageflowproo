// Consulta de viaturas por matrícula (Portugal) — server-side only.
// Provider atual: Matricula.co.pt / RegCheck (endpoint CheckPortugal, parâmetros
// RegistrationNumber + username). Credencial em REGCHECK_USERNAME, nunca exposta.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CACHE_DAYS = 30;
const TIMEOUT_MS = 12000;
const PT_PATTERNS = [/^[A-Z]{2}\d{2}[A-Z]{2}$/, /^\d{2}[A-Z]{2}\d{2}$/, /^\d{4}[A-Z]{2}$/, /^[A-Z]{2}\d{4}$/];

type Status = "ok" | "not_found" | "invalid" | "not_configured" | "limit" | "blocked" | "forbidden" | "unavailable" | "timeout" | "bad_credentials" | "unexpected" | "error" | "disabled" | "global_limit" | "cost_limit";

export interface VehicleData {
  make?: string; model?: string; version?: string; description?: string; year?: number;
  registration_date?: string; fuel?: string; engine_cc?: number; seats?: number; vin?: string;
  colour?: string; gross_weight_kg?: number; net_weight_kg?: number; imported?: boolean; image_url?: string;
}

interface VehicleDataProvider {
  id: string;
  configured(): boolean;
  lookup(plate: string): Promise<{ status: Status; data?: VehicleData; raw?: unknown; error?: string }>;
}

const FUEL_MAP: Record<string, string> = {
  GASOLINA: "Gasolina", DIESEL: "Diesel", GASOLEO: "Diesel", "GASÓLEO": "Diesel", ELECTRICO: "Elétrico",
  "ELÉCTRICO": "Elétrico", ELETRICO: "Elétrico", HIBRIDO: "Híbrido", "HÍBRIDO": "Híbrido", GPL: "GPL",
};
const txt = (v: any) => {
  const s = typeof v === "object" && v !== null ? v.CurrentTextValue : v;
  const t = (s ?? "").toString().trim();
  return t || undefined;
};
const num = (v: any) => { const t = txt(v); const n = t ? Number(t.replace(",", ".")) : NaN; return Number.isFinite(n) && n > 0 ? n : undefined; };

class MatriculaProvider implements VehicleDataProvider {
  id = "matricula_pt";
  private user = Deno.env.get("REGCHECK_USERNAME") || "";
  configured() { return this.user.length > 0; }
  async lookup(plate: string) {
    const url = `https://www.regcheck.org.uk/api/reg.asmx/CheckPortugal?RegistrationNumber=${encodeURIComponent(plate)}&username=${encodeURIComponent(this.user)}`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let body = "";
    let httpStatus = 0;
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      httpStatus = r.status;
      body = await r.text();
    } catch (e) {
      clearTimeout(to);
      return { status: ((e as Error).name === "AbortError" ? "timeout" : "unavailable") as Status, error: String(e) };
    }
    clearTimeout(to);
    const low = body.toLowerCase();
    if (low.includes("username is incorrect") || low.includes("out of credit") || low.includes("no credits")) {
      return { status: (low.includes("credit") ? "limit" : "bad_credentials") as Status, error: body.slice(0, 200) };
    }
    const m = body.match(/<vehicleJson>([\s\S]*?)<\/vehicleJson>/);
    if (!m) {
      if (low.includes("no vehicle") || low.includes("not found") || low.includes("invalid")) return { status: "not_found" as Status, error: body.slice(0, 200) };
      if (httpStatus >= 500) return { status: "unavailable" as Status, error: `HTTP ${httpStatus}` };
      return { status: "not_found" as Status, error: body.slice(0, 200) };
    }
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
    if (!decoded) return { status: "not_found" as Status };
    let j: any;
    try { j = JSON.parse(decoded); } catch { return { status: "unexpected" as Status, error: "json_parse" }; }
    const fuelRaw = txt(j.FuelType)?.toUpperCase();
    const data: VehicleData = {
      make: txt(j.CarMake) || txt(j.MakeDescription),
      model: txt(j.CarModel) || txt(j.ModelDescription),
      version: txt(j.Version),
      description: txt(j.Description),
      year: num(j.RegistrationYear),
      registration_date: txt(j.RegistrationDate),
      fuel: fuelRaw ? (FUEL_MAP[fuelRaw] || txt(j.FuelType)) : undefined,
      engine_cc: num(j.EngineSize),
      seats: num(j.NumberOfSeats),
      vin: txt(j.VechileIdentificationNumber) || txt(j.VehicleIdentificationNumber),
      colour: txt(j.Colour),
      gross_weight_kg: num(j.GrossWeight),
      net_weight_kg: num(j.NetWeight),
      imported: j.Imported === 1 || j.Imported === "1" ? true : undefined,
      image_url: txt(j.ImageUrl),
    };
    Object.keys(data).forEach((k) => (data as any)[k] === undefined && delete (data as any)[k]);
    if (!data.make && !data.model) return { status: "not_found" as Status };
    return { status: "ok" as Status, data };
  }
}

const PROVIDER: VehicleDataProvider = new MatriculaProvider();

const MANUAL = "Pode preencher os dados da viatura manualmente.";
const MESSAGES: Record<Status, string> = {
  disabled: MANUAL,
  global_limit: MANUAL,
  cost_limit: MANUAL,
  ok: "Viatura encontrada.",
  not_found: "Matrícula não encontrada. Pode preencher os dados manualmente.",
  invalid: "Matrícula inválida. Confirme a matrícula introduzida.",
  not_configured: "A consulta automática de matrícula ainda não está configurada. Pode continuar a adicionar a viatura manualmente.",
  limit: "Atingiu o limite de consultas de matrícula deste mês. Pode preencher os dados manualmente.",
  blocked: "As consultas de matrícula estão bloqueadas para esta oficina. Pode preencher os dados manualmente.",
  forbidden: "Não tem permissão para consultar matrículas nesta oficina.",
  unavailable: "Não foi possível consultar esta matrícula neste momento. Pode preencher os dados manualmente ou tentar novamente mais tarde.",
  timeout: "A consulta demorou demasiado. Pode preencher os dados manualmente ou tentar novamente mais tarde.",
  bad_credentials: "Não foi possível consultar esta matrícula neste momento. Pode preencher os dados manualmente ou tentar novamente mais tarde.",
  unexpected: "Não foi possível consultar esta matrícula neste momento. Pode preencher os dados manualmente ou tentar novamente mais tarde.",
  error: "Não foi possível consultar esta matrícula neste momento. Pode preencher os dados manualmente ou tentar novamente mais tarde.",
};

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPA_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    const user = u?.user;
    if (!user) return json({ status: "forbidden", message: MESSAGES.forbidden }, 401);

    let body: any = {};
    try { body = await req.json(); } catch { /* noop */ }

    // Admin: estado do provider (nunca mostra a credencial).
    if (body?.action === "provider_status") {
      const { data: isAdmin } = await admin.rpc("is_super_admin", { _user_id: user.id });
      if (!isAdmin) return json({ status: "forbidden" }, 403);
      const { data: last } = await admin.from("vehicle_lookups").select("status, created_at").eq("source", "api").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const state = !PROVIDER.configured() ? "not_configured" : (last && ["bad_credentials", "unavailable", "unexpected", "error"].includes(last.status) ? "error" : "configured");
      return json({ provider: "Matricula.co.pt / RegCheck", state, last });
    }

    const shopId = String(body?.shop_id || "");
    const vehicleId = body?.vehicle_id ? String(body.vehicle_id) : null;
    const force = body?.force === true;
    const plate = String(body?.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!UUID.test(shopId) || (vehicleId && !UUID.test(vehicleId))) return json({ status: "error", message: MESSAGES.error }, 400);

    // RLS: o utilizador tem de conseguir ver a oficina (membro/dono).
    const { data: shopRow } = await userClient.from("shops").select("id").eq("id", shopId).maybeSingle();
    if (!shopRow) return json({ status: "forbidden", message: MESSAGES.forbidden }, 403);
    if (vehicleId) {
      const { data: v } = await userClient.from("vehicles").select("id").eq("id", vehicleId).eq("shop_id", shopId).maybeSingle();
      if (!v) return json({ status: "forbidden", message: MESSAGES.forbidden }, 403);
    }

    const log = async (status: Status, source: string, extra: Record<string, unknown> = {}) => {
      await admin.from("vehicle_lookups").insert({
        shop_id: shopId, user_id: user.id, vehicle_id: vehicleId, plate_norm: plate || "-", provider: PROVIDER.id,
        source, status, duration_ms: Date.now() - t0, ...extra,
      });
    };

    if (!PT_PATTERNS.some((p) => p.test(plate))) {
      return json({ status: "invalid", message: MESSAGES.invalid });
    }

    // 1) Serviço global (kill switch) — decide sempre antes de qualquer outra coisa.
    const { data: cfgRow } = await admin.from("platform_settings").select("value").eq("key", "vehicle_lookup").maybeSingle();
    const cfg: any = cfgRow?.value || {};
    if (cfg.enabled === false) { await log("disabled", "blocked"); return json({ status: "disabled", message: MESSAGES.disabled }); }

    // 2) Oficina bloqueada
    const { data: lim } = await admin.from("vehicle_lookup_limits").select("monthly_limit, blocked").eq("shop_id", shopId).maybeSingle();
    if (lim?.blocked) { await log("blocked", "blocked"); return json({ status: "blocked", message: MESSAGES.blocked }); }

    // Cache (dados públicos de registo, sem dados internos de oficinas).
    if (!force) {
      const since = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
      const { data: cached } = await admin.from("vehicle_lookups").select("data, created_at")
        .eq("plate_norm", plate).eq("status", "ok").eq("source", "api").gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cached?.data) {
        await log("ok", "cache", { data: cached.data });
        return json({ status: "ok", source: "cache", fetched_at: cached.created_at, data: cached.data, message: MESSAGES.ok });
      }
    }

    // 3) Limite mensal da oficina (sem registo = ilimitado).
    const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    if (lim?.monthly_limit != null) {
      const { count } = await admin.from("vehicle_lookups").select("id", { count: "exact", head: true })
        .eq("shop_id", shopId).eq("source", "api").gte("created_at", start.toISOString());
      if ((count ?? 0) >= lim.monthly_limit) { await log("limit", "blocked"); return json({ status: "limit", message: MESSAGES.limit }); }
    }

    // 4) Limite global mensal e 5) proteção de custos — contam só chamadas reais ao provider.
    const { count: globalCount } = await admin.from("vehicle_lookups").select("id", { count: "exact", head: true })
      .eq("source", "api").gte("created_at", start.toISOString());
    const used = globalCount ?? 0;
    const unitCost = Number(cfg.cost_per_call) || 0;
    if (cfg.global_monthly_limit != null && used >= Number(cfg.global_monthly_limit)) {
      await log("global_limit", "blocked"); return json({ status: "global_limit", message: MESSAGES.global_limit });
    }
    if (cfg.auto_block_enabled && cfg.auto_block_cost != null && unitCost > 0 && (used + 1) * unitCost > Number(cfg.auto_block_cost) + 1e-9) {
      await log("cost_limit", "blocked");
      await auditOnce(admin, "vehicle_lookup_auto_block", start, { cost: used * unitCost, cap: cfg.auto_block_cost });
      return json({ status: "cost_limit", message: MESSAGES.cost_limit });
    }

    if (!PROVIDER.configured()) { await log("not_configured", "blocked"); return json({ status: "not_configured", message: MESSAGES.not_configured }); }

    const res = await PROVIDER.lookup(plate);
    if (res.status !== "ok") console.error("[vehicle-lookup]", res.status, res.error);
    await log(res.status, "api", { data: res.data ?? null, error_code: res.status === "ok" ? null : (res.error || res.status).slice(0, 200) });
    // Alerta de consumo (apenas registado para o Admin, uma vez por mês).
    const nowUsed = used + 1;
    if ((cfg.alert_count != null && nowUsed >= Number(cfg.alert_count)) ||
        (cfg.alert_cost != null && unitCost > 0 && nowUsed * unitCost >= Number(cfg.alert_cost))) {
      await auditOnce(admin, "vehicle_lookup_alert", start, { calls: nowUsed, cost: +(nowUsed * unitCost).toFixed(2) });
    }
    if (res.status !== "ok") return json({ status: res.status, message: MESSAGES[res.status] });
    return json({ status: "ok", source: "api", fetched_at: new Date().toISOString(), data: res.data, message: MESSAGES.ok });
  } catch (e) {
    console.error("[vehicle-lookup] internal", e);
    return json({ status: "error", message: MESSAGES.error }, 500);
  }
});

async function auditOnce(admin: any, action: string, since: Date, details: Record<string, unknown>) {
  const { count } = await admin.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("action", action).gte("created_at", since.toISOString());
  if (!count) await admin.from("audit_logs").insert({ action, entity_type: "vehicle_lookup", details });
}
