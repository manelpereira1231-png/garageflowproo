import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date();
    let processed = 0;

    // 1. Send reminders for pending/sent invites (7, 14, 30 days)
    const { data: pendingInvites } = await supabase
      .from("supplier_invites")
      .select("*, suppliers(name, contact_email)")
      .in("status", ["pending", "sent"])
      .lt("reminder_count", 3);

    for (const invite of pendingInvites || []) {
      const sentDate = invite.sent_at ? new Date(invite.sent_at) : new Date(invite.created_at);
      const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / 86400000);
      const lastReminder = invite.last_reminder_at ? new Date(invite.last_reminder_at) : null;
      const daysSinceReminder = lastReminder 
        ? Math.floor((now.getTime() - lastReminder.getTime()) / 86400000) 
        : daysSinceSent;

      // Send reminder at 7, 14, 30 days
      const shouldRemind = (invite.reminder_count === 0 && daysSinceSent >= 7) ||
                           (invite.reminder_count === 1 && daysSinceReminder >= 7) ||
                           (invite.reminder_count === 2 && daysSinceReminder >= 16);

      if (shouldRemind) {
        // Try to send reminder email via send-email function
        try {
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY && invite.shop_email) {
            const supplierName = (invite as any).suppliers?.name || "Fornecedor";
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "GarageFlow <noreply@garageflow.pt>",
                to: [invite.shop_email],
                subject: `Lembrete: Convite de parceria ${supplierName} - GarageFlow`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Olá ${invite.shop_name || ""}!</h2>
                    <p>Temos um convite pendente do fornecedor <strong>${supplierName}</strong> com um desconto exclusivo de <strong>${invite.discount_percent}%</strong>.</p>
                    <p>Plano oferecido: <strong>${invite.plan_offer.toUpperCase()}</strong> com <strong>${invite.trial_days} dias</strong> de trial gratuito.</p>
                    <p>Não perca esta oportunidade!</p>
                    <a href="https://garageflow-pt.lovable.app/auth" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;margin-top:16px;">Começar Agora</a>
                  </div>
                `,
              }),
            });
          }
        } catch (emailErr) {
          console.error("Email send failed:", emailErr);
        }

        await supabase.from("supplier_invites").update({
          reminder_count: invite.reminder_count + 1,
          last_reminder_at: now.toISOString(),
          status: invite.status === "pending" ? "sent" : invite.status,
        } as any).eq("id", invite.id);

        processed++;
      }
    }

    // 2. Expire old invites (60+ days without acceptance)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString();
    const { data: expired } = await supabase
      .from("supplier_invites")
      .update({ status: "expired" } as any)
      .in("status", ["pending", "sent"])
      .lt("created_at", sixtyDaysAgo)
      .select("id");

    return new Response(JSON.stringify({
      message: "Supplier automation completed",
      reminders_sent: processed,
      expired: expired?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
