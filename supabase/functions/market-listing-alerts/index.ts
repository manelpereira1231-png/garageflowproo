// Daily cron: scan listing_alerts and email matching new published listings.
// Also computes "daily seller summary" (views, messages, favorites today) and emails active sellers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "GarageFlow Market <noreply@garageflow.pt>";

async function sendEmail(resendKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  return res.ok;
}

function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function alertHtml(matches: any[]) {
  const cards = matches.slice(0, 8).map((l) => {
    const photoRaw = Array.isArray(l.photos) && l.photos[0] ? l.photos[0] : "";
    const photo = esc(photoRaw);
    const make = esc(l.make);
    const model = esc(l.model);
    const year = esc(l.year);
    const fuel = esc(l.fuel);
    const id = esc(l.id);
    return `<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px;font-family:Inter,Arial,sans-serif">
      ${photo ? `<img src="${photo}" style="width:100%;height:180px;object-fit:cover;display:block" alt="${make} ${model}"/>` : ""}
      <div style="padding:14px">
        <div style="font-weight:700;font-size:16px;color:#0f172a">${make} ${model} (${year})</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px">${Number(l.mileage).toLocaleString("pt-PT")} km · ${fuel}</div>
        <div style="color:#f59e0b;font-weight:800;font-size:20px;margin-top:6px">${Number(l.price).toLocaleString("pt-PT")} €</div>
        <a href="https://garageflow.pt/market/car/${id}" style="display:inline-block;margin-top:8px;background:#0f172a;color:#fbbf24;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">Ver anúncio</a>
      </div>
    </div>`;
  }).join("");

  return `<!doctype html><html><body style="background:#f1f5f9;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;font-family:Inter,Arial,sans-serif">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
      <div style="background:#fbbf24;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#0f172a">G</div>
      <strong style="color:#0f172a;font-size:16px">GarageFlow Market</strong>
    </div>
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 6px">Novos carros que combinam com o seu alerta</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 18px">Encontrámos ${matches.length} anúncio${matches.length > 1 ? "s" : ""} novo${matches.length > 1 ? "s" : ""} com inspeção certificada e Pagamento Protegido.</p>
    ${cards}
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;text-align:center">Recebe este email porque criou um alerta no GarageFlow Market.<br/>Pode gerir os seus alertas em <a href="https://garageflow.pt/market" style="color:#0f172a">garageflow.pt/market</a></p>
  </div>
  </body></html>`;
}

function summaryHtml(seller: any, items: any[]) {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600">${esc(it.make)} ${esc(it.model)}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center">${Number(it.views_today) || 0}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center">${Number(it.msgs_today) || 0}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center">${Number(it.favs_today) || 0}</td>
    </tr>`).join("");

  const firstName = esc(seller?.name?.split(" ")[0] || "vendedor");

  return `<!doctype html><html><body style="background:#f1f5f9;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;font-family:Inter,Arial,sans-serif">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
      <div style="background:#fbbf24;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#0f172a">G</div>
      <strong style="color:#0f172a;font-size:16px">GarageFlow Market</strong>
    </div>
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 4px">Olá ${firstName}, eis o resumo de hoje</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 18px">Atividade nas suas listagens nas últimas 24h.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr><th style="text-align:left;padding:8px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Anúncio</th>
        <th style="padding:8px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Visitas</th>
        <th style="padding:8px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Msgs</th>
        <th style="padding:8px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Favoritos</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <a href="https://garageflow.pt/market/seller" style="display:inline-block;margin-top:18px;background:#fbbf24;color:#0f172a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">Abrir Painel de Vendedor</a>
  </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const stats = { alerts_processed: 0, alert_emails_sent: 0, summaries_sent: 0, errors: 0 };

  try {
    // 1) Listing alerts (last 24h new published)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: newListings } = await admin
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos")
      .eq("status", "published")
      .gte("published_at", since);

    const { data: alerts } = await admin
      .from("listing_alerts")
      .select("*")
      .eq("active", true);

    if (alerts && newListings) {
      for (const alert of alerts) {
        stats.alerts_processed++;
        const matches = newListings.filter((l: any) => {
          if (alert.make && l.make.toLowerCase() !== alert.make.toLowerCase()) return false;
          if (alert.model && l.model.toLowerCase() !== alert.model.toLowerCase()) return false;
          if (alert.fuel && l.fuel !== alert.fuel) return false;
          if (alert.min_year && l.year < alert.min_year) return false;
          if (alert.max_price && l.price > alert.max_price) return false;
          if (alert.max_mileage && l.mileage > alert.max_mileage) return false;
          return true;
        });
        if (matches.length === 0) continue;
        if (RESEND_KEY) {
          const ok = await sendEmail(
            RESEND_KEY,
            alert.email,
            `🚗 ${matches.length} novo${matches.length > 1 ? "s" : ""} carro${matches.length > 1 ? "s" : ""} para si — GarageFlow Market`,
            alertHtml(matches),
          );
          if (ok) {
            stats.alert_emails_sent++;
            await admin.from("listing_alerts").update({ last_sent_at: new Date().toISOString() }).eq("id", alert.id);
          } else {
            stats.errors++;
          }
        }
      }
    }

    // 2) Daily seller summaries
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);

    const { data: activeListings } = await admin
      .from("carity_listings")
      .select("id, seller_id, make, model")
      .eq("status", "published");

    if (activeListings) {
      const bySeller: Record<string, any[]> = {};
      for (const l of activeListings) {
        (bySeller[l.seller_id] ||= []).push(l);
      }
      const sellerIds = Object.keys(bySeller);

      // Pull all profiles in batch
      const { data: profiles } = await admin
        .from("carity_seller_profiles")
        .select("user_id, name")
        .in("user_id", sellerIds);

      for (const sellerId of sellerIds) {
        const listings = bySeller[sellerId];
        const profile = profiles?.find((p: any) => p.user_id === sellerId);
        if (!profile) continue;

        const { data: authUser } = await admin.auth.admin.getUserById(sellerId);
        const email = authUser?.user?.email;
        if (!email) continue;

        // Aggregate stats per listing
        const items: any[] = [];
        let total = 0;
        for (const l of listings) {
          const [v, m, f] = await Promise.all([
            admin.from("listing_views").select("id", { count: "exact", head: true })
              .eq("listing_id", l.id).gte("created_at", todayStart.toISOString()),
            admin.from("carity_chat_messages").select("id", { count: "exact", head: true })
              .eq("listing_id", l.id).gte("created_at", todayStart.toISOString()),
            admin.from("listing_favorites").select("id", { count: "exact", head: true })
              .eq("listing_id", l.id).gte("created_at", todayStart.toISOString()),
          ]);
          const row = {
            make: l.make, model: l.model,
            views_today: v.count || 0,
            msgs_today: m.count || 0,
            favs_today: f.count || 0,
          };
          total += row.views_today + row.msgs_today + row.favs_today;
          items.push(row);
        }

        if (total === 0) continue; // skip silent days
        if (RESEND_KEY) {
          const ok = await sendEmail(
            RESEND_KEY,
            email,
            `Hoje: ${total} interações nos seus anúncios — GarageFlow Market`,
            summaryHtml(profile, items),
          );
          if (ok) stats.summaries_sent++;
          else stats.errors++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "error", stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
