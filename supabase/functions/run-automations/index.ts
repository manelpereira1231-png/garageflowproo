import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function automationEmailHtml(
  shopName: string,
  title: string,
  message: string,
  items: string[],
  ctaLabel?: string,
  ctaUrl?: string
): string {
  const itemsHtml = items.length > 0
    ? `<ul style="margin:16px 0;padding-left:20px;">${items.map(i => `<li style="color:#374151;font-size:14px;margin-bottom:6px;">${i}</li>`).join('')}</ul>`
    : '';
  const ctaHtml = ctaLabel && ctaUrl
    ? `<div style="text-align:center;margin:24px 0;"><a href="${ctaUrl}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${ctaLabel}</a></div>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#262626;padding:20px 28px;border-radius:10px 10px 0 0;">
        <span style="color:#ffb41e;font-size:18px;font-weight:700;">${shopName}</span>
      </div>
      <div style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
        <h2 style="color:#1f2937;font-size:18px;margin:0 0 12px;">${title}</h2>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 16px;">${message}</p>
        ${itemsHtml}
        ${ctaHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#bbb;font-size:11px;text-align:center;">Automação GarageFlow · ${shopName}</p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  // Auth guard: only the platform (cron / service role) may invoke
  const __auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    || (req.headers.get("x-internal-token") ?? "");
  if (__auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  try {
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("active", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const rule of rules) {
      try {
        let triggered = false;
        let details: any = {};
        let emailSubject = "";
        let emailMessage = "";
        let emailItems: string[] = [];
        let recipientEmails: string[] = [];

        // Get shop info for emails
        const { data: shop } = await supabase
          .from("shops")
          .select("name, email, labor_rate, currency")
          .eq("id", rule.shop_id)
          .single();
        const shopName = shop?.name || "GarageFlow";
        const shopEmail = shop?.email || "";
        const laborRate = Number((shop as any)?.labor_rate) || 0;
        const currency = ((shop as any)?.currency as string) || "EUR";
        const money = (v: number) =>
          new Intl.NumberFormat("pt-PT", { style: "currency", currency, minimumFractionDigits: 2 }).format(v || 0);
        const laborLine = (hours: number | null | undefined) => {
          const h = Number(hours) || 0;
          if (h <= 0 || laborRate <= 0) return "Mão-de-obra: não aplicável";
          return `Mão-de-obra: ${money(h * laborRate)} (${h.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h × ${money(laborRate)}/h)`;
        };
        // Track per-recipient labor summary for client emails
        const recipientLabor: Record<string, string> = {};

        switch (rule.trigger_type) {
          case "invoice_overdue": {
            const { data: overdue } = await supabase
              .from("invoices")
              .select("id, number, client_id, total, clients(name, email)")
              .eq("shop_id", rule.shop_id)
              .eq("status", "issued")
              .lt("due_date", new Date().toISOString().split("T")[0]);
            if (overdue && overdue.length > 0) {
              triggered = true;
              details = { count: overdue.length, invoices: overdue.map(i => i.number) };
              emailSubject = `⚠️ ${overdue.length} fatura(s) vencida(s)`;
              emailMessage = `Existem ${overdue.length} fatura(s) por regularizar na sua oficina.`;
              emailItems = overdue.slice(0, 10).map(i => `${i.number} — ${(i.clients as any)?.name || 'Cliente'}`);
              // Send reminder to each client with overdue invoice
              for (const inv of overdue) {
                const clientEmail = (inv.clients as any)?.email;
                if (clientEmail) recipientEmails.push(clientEmail);
              }
            }
            break;
          }
          case "client_inactive": {
            const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
            const { data: inactive } = await supabase
              .from("clients")
              .select("id, name, email")
              .eq("shop_id", rule.shop_id)
              .is("deleted_at", null)
              .lt("created_at", cutoff)
              .limit(50);
            if (inactive && inactive.length > 0) {
              const clientIds = inactive.map(c => c.id);
              const { data: recentOrders } = await supabase
                .from("work_orders")
                .select("client_id")
                .eq("shop_id", rule.shop_id)
                .in("client_id", clientIds)
                .gte("created_at", cutoff);
              const activeClientIds = new Set((recentOrders || []).map(o => o.client_id));
              const trueInactive = inactive.filter(c => !activeClientIds.has(c.id));
              if (trueInactive.length > 0) {
                triggered = true;
                details = { count: trueInactive.length, clients: trueInactive.slice(0, 5).map(c => c.name) };
                emailSubject = `📋 ${trueInactive.length} cliente(s) inativo(s)`;
                emailMessage = `Estes clientes não visitam a oficina há mais de 90 dias.`;
                emailItems = trueInactive.slice(0, 10).map(c => c.name);
              }
            }
            break;
          }
          case "low_stock": {
            const { data: lowParts } = await supabase
              .from("parts")
              .select("id, name, stock_quantity, min_stock")
              .eq("shop_id", rule.shop_id)
              .eq("active", true);
            const low = (lowParts || []).filter(p => p.stock_quantity <= p.min_stock);
            if (low.length > 0) {
              triggered = true;
              details = { count: low.length, parts: low.slice(0, 5).map(p => p.name) };
              emailSubject = `🔧 ${low.length} peça(s) com stock baixo`;
              emailMessage = `As seguintes peças atingiram o stock mínimo.`;
              emailItems = low.slice(0, 10).map(p => `${p.name} — ${p.stock_quantity}/${p.min_stock} unid.`);
            }
            break;
          }
          case "quote_pending": {
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
            const { data: pending } = await supabase
              .from("quotes")
              .select("id, number, clients(name, email)")
              .eq("shop_id", rule.shop_id)
              .eq("status", "sent")
              .lt("created_at", threeDaysAgo);
            if (pending && pending.length > 0) {
              triggered = true;
              details = { count: pending.length };
              emailSubject = `📝 ${pending.length} orçamento(s) pendente(s) há mais de 3 dias`;
              emailMessage = `Estes orçamentos aguardam resposta do cliente.`;
              emailItems = pending.slice(0, 10).map(q => `${q.number} — ${(q.clients as any)?.name || 'Cliente'}`);
            }
            break;
          }
          case "service_reminder": {
            const upcoming = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
            const { data: reminders } = await supabase
              .from("service_reminders")
              .select("id, service_type, clients(name, email), vehicles(make, model, plate)")
              .eq("shop_id", rule.shop_id)
              .eq("status", "pending")
              .lte("next_service_date", upcoming);
            if (reminders && reminders.length > 0) {
              triggered = true;
              details = { count: reminders.length };
              emailSubject = `🔔 ${reminders.length} revisão(ões) próxima(s)`;
              emailMessage = `Os seguintes veículos têm revisões agendadas para os próximos 7 dias.`;
              emailItems = reminders.slice(0, 10).map(r => {
                const v = r.vehicles as any;
                return `${v?.make || ''} ${v?.model || ''} (${v?.plate || ''}) — ${(r.clients as any)?.name || ''}`;
              });
            }
            break;
          }
          case "quote_approved": {
            const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
            const { data: approved } = await supabase
              .from("quotes")
              .select("id, number, total, clients(name, email)")
              .eq("shop_id", rule.shop_id)
              .eq("status", "approved")
              .gte("created_at", oneDayAgo);
            if (approved && approved.length > 0) {
              triggered = true;
              details = { count: approved.length };
              emailSubject = `✅ ${approved.length} orçamento(s) aprovado(s)`;
              emailMessage = `Os seguintes orçamentos foram aprovados pelo cliente.`;
              emailItems = approved.slice(0, 10).map(q => `${q.number} — ${(q.clients as any)?.name || ''}`);
            }
            break;
          }
          case "service_completed": {
            const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
            const { data: completed } = await supabase
              .from("work_orders")
              .select("id, number, total, clients(name, email), vehicles(make, model, plate)")
              .eq("shop_id", rule.shop_id)
              .eq("status", "completed")
              .gte("completed_at", oneDayAgo);
            if (completed && completed.length > 0) {
              triggered = true;
              details = { count: completed.length };
              emailSubject = `🏁 ${completed.length} serviço(s) concluído(s)`;
              emailMessage = `Os seguintes serviços foram concluídos nas últimas 24 horas.`;
              emailItems = completed.slice(0, 10).map(wo => {
                const v = wo.vehicles as any;
                return `${wo.number} — ${v?.make || ''} ${v?.model || ''} (${(wo.clients as any)?.name || ''})`;
              });
              // Notify clients their vehicle is ready
              for (const wo of completed) {
                const clientEmail = (wo.clients as any)?.email;
                if (clientEmail) recipientEmails.push(clientEmail);
              }
            }
            break;
          }
        }

        if (triggered) {
          // Execute action
          if (rule.action_type === "send_email" && resend && shopEmail) {
            // Send summary email to shop owner
            const html = automationEmailHtml(shopName, emailSubject, emailMessage, emailItems);
            try {
              await resend.emails.send({
                from: `GarageFlow <noreply@garageflow.pt>`,
                to: [shopEmail],
                subject: emailSubject,
                html,
              });
              // Log the email
              await supabase.from("email_logs").insert({
                shop_id: rule.shop_id,
                to_email: shopEmail,
                subject: emailSubject,
                status: "sent",
                entity_type: "automation",
                entity_id: rule.id,
              });
            } catch (emailErr: any) {
              console.error("Email send error:", emailErr);
              await supabase.from("email_logs").insert({
                shop_id: rule.shop_id,
                to_email: shopEmail,
                subject: emailSubject,
                status: "failed",
                error_message: emailErr?.message || "Unknown error",
                entity_type: "automation",
                entity_id: rule.id,
              });
            }

            // Send individual client notifications for specific triggers
            if (recipientEmails.length > 0 && rule.trigger_type === "service_completed") {
              for (const email of recipientEmails.slice(0, 20)) {
                try {
                  const clientHtml = automationEmailHtml(
                    shopName,
                    "O seu veículo está pronto! 🚗",
                    `O serviço do seu veículo foi concluído na ${shopName}. Pode levantar o veículo quando for mais conveniente.`,
                    [],
                  );
                  await resend.emails.send({
                    from: `${shopName} <noreply@garageflow.pt>`,
                    to: [email],
                    subject: `O seu veículo está pronto — ${shopName}`,
                    html: clientHtml,
                  });
                  await supabase.from("email_logs").insert({
                    shop_id: rule.shop_id, to_email: email,
                    subject: `Veículo pronto — ${shopName}`,
                    status: "sent", entity_type: "automation_client", entity_id: rule.id,
                  });
                } catch (_) { /* silently skip individual failures */ }
              }
            }

            if (recipientEmails.length > 0 && rule.trigger_type === "invoice_overdue") {
              for (const email of recipientEmails.slice(0, 20)) {
                try {
                  const clientHtml = automationEmailHtml(
                    shopName,
                    "Lembrete de pagamento",
                    `Informamos que tem uma fatura pendente na ${shopName}. Por favor regularize o pagamento assim que possível.`,
                    [],
                  );
                  await resend.emails.send({
                    from: `${shopName} <noreply@garageflow.pt>`,
                    to: [email],
                    subject: `Lembrete de pagamento — ${shopName}`,
                    html: clientHtml,
                  });
                  await supabase.from("email_logs").insert({
                    shop_id: rule.shop_id, to_email: email,
                    subject: `Lembrete pagamento — ${shopName}`,
                    status: "sent", entity_type: "automation_client", entity_id: rule.id,
                  });
                } catch (_) { /* silently skip */ }
              }
            }
          } else if (rule.action_type === "send_sms" || rule.action_type === "send_whatsapp") {
            // Channel not yet configured — log as skipped, do not fake success
            await supabase.from("automation_logs").insert({
              shop_id: rule.shop_id,
              rule_id: rule.id,
              trigger_type: rule.trigger_type,
              action_type: rule.action_type,
              status: "skipped",
              details: { reason: "Channel not configured" },
            });
            continue;
          } else if (rule.action_type === "create_alert") {
            await supabase.from("alerts").insert({
              shop_id: rule.shop_id,
              title: rule.name,
              message: emailMessage || JSON.stringify(details),
              type: rule.trigger_type,
              priority: "medium",
            });
          } else if (rule.action_type === "create_notification") {
            await supabase.from("notifications").insert({
              shop_id: rule.shop_id,
              title: rule.name,
              message: `${emailSubject || rule.trigger_type} — ${details.count || 0} itens`,
              type: "automation",
            });
          }

          // Log execution
          await supabase.from("automation_logs").insert({
            shop_id: rule.shop_id,
            rule_id: rule.id,
            trigger_type: rule.trigger_type,
            action_type: rule.action_type,
            status: "success",
            details: { ...details, emails_sent: recipientEmails.length },
          });

          // Update rule
          await supabase.from("automation_rules").update({
            last_run_at: new Date().toISOString(),
            run_count: (rule.run_count || 0) + 1,
          }).eq("id", rule.id);

          processed++;
        }
      } catch (ruleErr: any) {
        await supabase.from("automation_logs").insert({
          shop_id: rule.shop_id,
          rule_id: rule.id,
          trigger_type: rule.trigger_type,
          action_type: rule.action_type,
          status: "error",
          details: { error: ruleErr.message },
        });
      }
    }

    return new Response(JSON.stringify({ message: "Done", processed, total_rules: rules.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
