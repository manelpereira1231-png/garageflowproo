import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "work-order-files";
const PHASE: Record<string, string> = {
  new: "entrada", waiting_data: "entrada", reported: "entrada", waiting_docs: "entrada",
  waiting_expert: "peritagem", expert_scheduled: "peritagem", expert_done: "peritagem",
  quote_preparing: "autorizacao", quote_sent: "autorizacao", changes_requested: "autorizacao",
  waiting_authorization: "autorizacao", waiting_approval: "autorizacao", approved: "autorizacao",
  partially_approved: "autorizacao", rejected: "autorizacao", repairing: "reparacao", waiting_parts: "reparacao",
  repair_done: "faturacao", waiting_invoice: "faturacao", invoiced: "faturacao", waiting_payment: "faturacao", paid: "faturacao",
  done: "fechado", cancelled: "fechado",
};
const ORDER = ["entrada", "peritagem", "autorizacao", "reparacao", "faturacao", "fechado"];
const pathOf = (url: string) => (url.includes(`/${BUCKET}/`) ? decodeURIComponent(url.split(`/${BUCKET}/`)[1].split("?")[0]) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    if (typeof token !== "string" || token.length < 20 || token.length > 100) return json({ error: "invalid" }, 404);
    const backendUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!backendUrl || !serviceKey) return json({ error: "unavailable" }, 503);
    const admin = createClient(backendUrl, serviceKey);
    const { data: link } = await admin.from("claim_share_links").select("*").eq("token", token).maybeSingle();
    if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) return json({ error: "expired" }, 404);

    const { data: claim } = await admin.from("claims")
      .select("id, shop_id, ref, process_number, claim_number, status, outcome, total_loss, phase_override, work_order_id, deductible, quote_id, insurer_id, vehicle_in_date, vehicle_out_date, promised_date, expert_done_date, expert_date, client_decision, last_client_message, amount_approved, insurers(name), vehicles(make, model, plate, year, version, vin, mileage, fuel)")
      .eq("id", link.claim_id).eq("shop_id", link.shop_id).maybeSingle();
    if (!claim || claim.shop_id !== link.shop_id) return json({ error: "invalid" }, 404);
    const [{ data: shop }, { data: sups }] = await Promise.all([
      admin.from("shops").select("name, phone, email, logo_url, currency, country_code").eq("id", claim.shop_id).maybeSingle(),
      admin.from("claim_supplements").select("id, type, number, description, amount_requested, amount_approved, status, requested_at, decided_at, quote_id, notes").eq("claim_id", claim.id).order("created_at"),
    ]);
    const list = sups || [];
    const authorized = list.length ? list.filter((s: any) => s.status === "approved" || s.status === "partial").reduce((t: number, s: any) => t + Number(s.amount_approved || 0), 0) : Number(claim.amount_approved || 0);
    const vehicle = claim.vehicles as any;
    const base = { shop: { name: shop?.name, phone: shop?.phone, logo_url: shop?.logo_url, currency: shop?.currency || "EUR", country: shop?.country_code || "PT" }, vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, plate: vehicle.plate, year: vehicle.year } : null, ref: claim.ref, insurer: (claim as any).insurers?.name || null };

    const quoteLines = async (ids: string[]) => {
      if (!ids.length) return [] as any[];
      const { data } = await admin.from("quotes").select("id, lines").in("id", [...new Set(ids)]).eq("shop_id", claim.shop_id);
      return (data || []).flatMap((q: any) => (Array.isArray(q.lines) ? q.lines : []).map((l: any) => ({ quote_id: q.id, name: l.name || l.description || "", quantity: Number(l.qty ?? l.quantity ?? 1), unit_price: Number(l.unitPrice ?? l.unit_price ?? 0), covered: l.covered_by_insurance !== false })));
    };

    if (link.audience === "cliente") {
      if (body.action && body.action !== "view") return json({ error: "forbidden" }, 403);
      let idx = ORDER.indexOf(PHASE[claim.status] || "entrada");
      const initial = list.find((s: any) => s.type === "inicial");
      if (initial && ["approved", "partial"].includes(initial.status)) idx = Math.max(idx, 3);
      const pendingSup = list.some((s: any) => s.type === "adicional" && ["pending", "no_perito"].includes(s.status));
      if (pendingSup && idx < 4) idx = 2;
       if (claim.work_order_id) {
         const { data: wo } = await admin.from("work_orders").select("status").eq("id", claim.work_order_id).eq("shop_id", claim.shop_id).maybeSingle();
         if (["completed", "done", "delivered", "ready", "invoiced"].includes(wo?.status || "")) idx = Math.max(idx, 4);
       }
       const { data: invoices } = await admin.from("invoices").select("id,total,status,payments(amount)").eq("claim_id", claim.id).eq("shop_id", claim.shop_id);
       const live = (invoices || []).filter((i: any) => !["draft", "cancelled"].includes(i.status));
       const billed = live.reduce((t: number, i: any) => t + Number(i.total || 0), 0);
       const paid = live.reduce((t: number, i: any) => t + (i.payments || []).reduce((p: number, x: any) => p + Number(x.amount || 0), 0), 0);
       if (billed > 0 && paid >= billed - 0.01) idx = 5;
       if (claim.phase_override && ORDER.includes(claim.phase_override)) idx = ORDER.indexOf(claim.phase_override);
      const lines = await quoteLines([claim.quote_id, ...list.map((s: any) => s.quote_id)].filter(Boolean) as string[]);
      const extras = lines.filter((l) => !l.covered).reduce((t, l) => t + l.quantity * l.unit_price, 0);
      const franchise = Number(claim.deductible || 0);
      return json({
        ...base, audience: "cliente", phase: (claim.outcome === "perda_total" || claim.total_loss) ? "perda_total" : ORDER[idx], pendingSup,
        status: claim.status, message: claim.last_client_message,
        timeline: [
          { key: "received", label: "Viatura recebida", date: claim.vehicle_in_date, done: !!claim.vehicle_in_date },
          { key: "expert", label: "Perito avaliou os danos", date: claim.expert_done_date, done: !!claim.expert_done_date || idx >= 2 },
          { key: "auth", label: "Seguradora autorizou a reparação", date: initial?.decided_at || null, done: idx >= 3 },
          ...list.filter((s: any) => s.type === "adicional").map((s: any) => ({ key: `sup-${s.number}`, label: `Danos adicionais #${s.number}: ${["approved", "partial"].includes(s.status) ? "autorizados" : s.status === "rejected" ? "não autorizados" : "à espera da seguradora"}`, date: s.decided_at || s.requested_at, done: !["pending", "no_perito"].includes(s.status) })),
          { key: "ready", label: "Pronto para levantar", date: claim.vehicle_out_date || claim.promised_date, done: idx >= 4, expected: !claim.vehicle_out_date },
        ],
        clientShare: { franchise, extras: Math.round(extras * 100) / 100, total: Math.round((franchise + extras) * 100) / 100 },
      });
    }

    // perito
    if (link.audience !== "perito") return json({ error: "forbidden" }, 403);
    if (body.action && !["view", "decide"].includes(body.action)) return json({ error: "invalid_action" }, 400);
    const sup = list.find((s: any) => s.id === link.supplement_id);
    if (!sup) return json({ error: "invalid" }, 404);

    if (body.action === "decide") {
      if (!["pending", "no_perito"].includes(sup.status)) return json({ error: "already_decided" }, 409);
      const decision = body.decision;
      if (!["approve", "reject", "more_photos"].includes(decision)) return json({ error: "decision" }, 400);
      if (decision === "approve" && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0 || Number(body.amount) > Number(sup.amount_requested))) return json({ error: "amount" }, 400);
      const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : "";
      const today = new Date().toISOString().slice(0, 10);
      let reportName: string | null = null;
      if (body.report && typeof body.report.base64 === "string" && body.report.base64.length < 14_000_000) {
        const bin = Uint8Array.from(atob(body.report.base64), (c) => c.charCodeAt(0));
        const safe = String(body.report.name || "relatorio.pdf").replace(/[^\w.\-]/g, "_").slice(0, 80);
        const type = String(body.report.type || "application/pdf");
        if (!/^(application\/pdf|image\/)/.test(type)) return json({ error: "file_type" }, 400);
        const path = `${claim.shop_id}/claims/${claim.id}/${Date.now()}-perito-${safe}`;
        const up = await admin.storage.from(BUCKET).upload(path, bin, { contentType: type });
        if (!up.error) {
          const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
          await admin.from("claim_documents").insert({ shop_id: claim.shop_id, claim_id: claim.id, category: "expertise", file_name: safe, file_url: pub.publicUrl, file_type: type, file_size: bin.length, notes: "Enviado pelo perito via link" });
          reportName = safe;
        }
      }
      const label = sup.type === "inicial" ? "Orçamento inicial" : `Adicional #${sup.number}`;
      if (decision === "approve") {
        const amount = Number(body.amount);
        if (!(amount > 0)) return json({ error: "amount" }, 400);
        const status = amount < Number(sup.amount_requested) ? "partial" : "approved";
        const value = Math.min(amount, Number(sup.amount_requested));
        const { data: changed, error: changeError } = await admin.from("claim_supplements").update({ status, amount_approved: value, decided_at: today, decided_by: "perito via link", notes: notes || sup.notes }).eq("id", sup.id).eq("status", sup.status).select("id").maybeSingle();
        if (changeError) return json({ error: "save_failed" }, 500);
        if (!changed) return json({ error: "already_decided" }, 409);
        const total = list.map((s: any) => (s.id === sup.id ? { ...s, status, amount_approved: value } : s))
          .filter((s: any) => s.status === "approved" || s.status === "partial").reduce((t: number, s: any) => t + Number(s.amount_approved || 0), 0);
        await admin.from("claims").update({ amount_approved: total, approval_date: today }).eq("id", claim.id);
        await admin.from("claim_events").insert({ claim_id: claim.id, shop_id: claim.shop_id, kind: "approval", description: `${label} validado pelo perito via link (${value.toFixed(2)})${notes ? ` — ${notes}` : ""}${reportName ? " · relatório anexado" : ""}` });
      } else if (decision === "reject") {
        const { data: changed, error: changeError } = await admin.from("claim_supplements").update({ status: "rejected", amount_approved: 0, decided_at: today, decided_by: "perito via link", notes: notes || sup.notes }).eq("id", sup.id).eq("status", sup.status).select("id").maybeSingle();
        if (changeError) return json({ error: "save_failed" }, 500);
        if (!changed) return json({ error: "already_decided" }, 409);
        const total = list.filter((s: any) => s.id !== sup.id && ["approved", "partial"].includes(s.status)).reduce((t: number, s: any) => t + Number(s.amount_approved || 0), 0);
        await admin.from("claims").update({ amount_approved: total }).eq("id", claim.id);
        await admin.from("claim_events").insert({ claim_id: claim.id, shop_id: claim.shop_id, kind: "approval", description: `${label} não validado pelo perito via link${notes ? ` — ${notes}` : ""}` });
      } else if (decision === "more_photos") {
        await admin.from("claim_supplements").update({ status: "no_perito", notes: `Perito pediu mais fotografias${notes ? `: ${notes}` : ""}` }).eq("id", sup.id);
        await admin.from("claim_events").insert({ claim_id: claim.id, shop_id: claim.shop_id, kind: "note", description: `Perito pediu mais fotografias para ${label}${notes ? ` — ${notes}` : ""}` });
      } else return json({ error: "decision" }, 400);
      return json({ ok: true });
    }

    const { data: docs } = await admin.from("claim_documents").select("file_url, file_type, file_name, category, notes").eq("claim_id", claim.id).in("category", ["hidden_damage", "damage", "photos"]);
    const allowedDocs = (docs || []).filter((d: any) => sup.type === "inicial" ? ["damage", "photos"].includes(d.category) : d.notes === `authorization:${sup.id}`);
    const paths = allowedDocs.filter((d: any) => (d.file_type || "").startsWith("image/")).map((d: any) => pathOf(d.file_url)).filter((p: any) => p && p.startsWith(`${claim.shop_id}/`)) as string[];
    const signed = paths.length ? (await admin.storage.from(BUCKET).createSignedUrls(paths.slice(0, 30), 3600)).data || [] : [];
    const lines = sup.quote_id ? await quoteLines([sup.quote_id]) : [];
    const initial = list.find((s: any) => s.type === "inicial");
    return json({
       ...base, vehicle: claim.vehicles, audience: "perito", processNumber: claim.process_number || claim.claim_number || null,
      supplement: { type: sup.type, number: sup.number, description: sup.description, amount_requested: Number(sup.amount_requested), status: sup.status, amount_approved: sup.amount_approved, notes: sup.notes },
      expertDate: claim.expert_done_date || claim.expert_date, initialAuthorized: initial?.amount_approved ?? null, authorized,
      photos: signed.map((s: any) => s.signedUrl).filter(Boolean), lines,
    });
  } catch (e) {
    console.error("claim-share request failed");
    return json({ error: "unavailable" }, 500);
  }
});
