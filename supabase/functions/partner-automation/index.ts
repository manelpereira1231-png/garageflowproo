import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const now = new Date();
    let reminders_sent = 0;
    let expired_count = 0;
    let commissions_created = 0;

    // 1. Send reminders for pending invites (7, 14, 30 days)
    const { data: pendingInvites } = await supabase
      .from("partner_invites")
      .select("*, partners(name, contact_email, commission_percentage)")
      .in("status", ["pending", "sent"])
      .lt("reminder_count", 3);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    for (const invite of pendingInvites || []) {
      const sentDate = invite.sent_at ? new Date(invite.sent_at) : new Date(invite.created_at);
      const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / 86400000);
      const lastReminder = invite.last_reminder_at ? new Date(invite.last_reminder_at) : null;
      const daysSinceReminder = lastReminder
        ? Math.floor((now.getTime() - lastReminder.getTime()) / 86400000)
        : daysSinceSent;

      const shouldRemind = (invite.reminder_count === 0 && daysSinceSent >= 7) ||
                           (invite.reminder_count === 1 && daysSinceReminder >= 7) ||
                           (invite.reminder_count === 2 && daysSinceReminder >= 16);

      if (shouldRemind) {
        if (RESEND_API_KEY && invite.workshop_email) {
          try {
            const partnerName = (invite as any).partners?.name || "Parceiro";
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "GarageFlow <noreply@garageflow.pt>",
                to: [invite.workshop_email],
                subject: `Lembrete: Convite de parceria ${partnerName} — GarageFlow`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2>Olá ${invite.workshop_name || ""}!</h2>
                    <p>O parceiro <strong>${partnerName}</strong> convidou-o para o GarageFlow com desconto exclusivo de <strong>${invite.discount_percent}%</strong>.</p>
                    <p>Plano: <strong>${invite.plan_offer.toUpperCase()}</strong> | Trial: <strong>${invite.trial_days} dias</strong></p>
                    <a href="https://garageflow-pt.lovable.app/auth?invite=${invite.invite_token}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;margin-top:16px;">Começar Agora</a>
                  </div>`,
              }),
            });
          } catch (e) { console.error("Email failed:", e); }
        }

        await supabase.from("partner_invites").update({
          reminder_count: invite.reminder_count + 1,
          last_reminder_at: now.toISOString(),
          status: invite.status === "pending" ? "sent" : invite.status,
        } as any).eq("id", invite.id);

        // Log
        await supabase.from("partner_logs").insert({
          partner_id: invite.partner_id,
          action: "invite_reminder",
          details: { invite_id: invite.id, workshop_email: invite.workshop_email, reminder: invite.reminder_count + 1 },
        } as any);

        reminders_sent++;
      }
    }

    // 2. Expire old invites (60+ days)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString();
    const { data: expiredInvites } = await supabase
      .from("partner_invites")
      .update({ status: "expired" } as any)
      .in("status", ["pending", "sent"])
      .lt("created_at", sixtyDaysAgo)
      .select("id");
    expired_count = expiredInvites?.length || 0;

    // 3. Calculate commissions for active referrals without commissions this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: referrals } = await supabase
      .from("partner_referrals")
      .select("*, partners(commission_percentage)");

    for (const ref of referrals || []) {
      // Check if commission already exists for this month
      const { data: existing } = await supabase
        .from("partner_commissions")
        .select("id")
        .eq("referral_id", ref.id)
        .gte("created_at", monthStart)
        .maybeSingle();

      if (!existing && ref.subscription_id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("id", ref.subscription_id)
          .maybeSingle();

        if (sub && sub.status === "active" && sub.plan !== "free") {
          const planPrice = sub.plan === "garage" ? 99 : 49;
          const rate = (ref as any).partners?.commission_percentage || ref.commission_rate || 10;
          const amount = (planPrice * rate) / 100;

          await supabase.from("partner_commissions").insert({
            partner_id: ref.partner_id,
            shop_id: ref.shop_id,
            referral_id: ref.id,
            amount,
            status: "pending",
            period_start: monthStart.split("T")[0],
            period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
          } as any);

          commissions_created++;
        }
      }
    }

    return new Response(JSON.stringify({
      message: "Partner automation completed",
      reminders_sent,
      expired: expired_count,
      commissions_created,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
