import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) throw new Error("Unauthorized");

    // Verify super admin
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: isSuper } = await adminClient.rpc("is_super_admin", { _user_id: userData.user.id });
    if (!isSuper) throw new Error("Forbidden — super admin only");

    const { action, target_user_id, target_email, payload } = await req.json();

    let result: any = {};

    switch (action) {
      case "send_password_reset": {
        if (!target_email) throw new Error("target_email required");
        const { error } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: target_email,
        });
        if (error) throw error;
        result = { ok: true, message: `Email de recuperação enviado para ${target_email}` };
        break;
      }
      case "ban_user": {
        if (!target_user_id) throw new Error("target_user_id required");
        const { error } = await adminClient.auth.admin.updateUserById(target_user_id, {
          ban_duration: payload?.duration || "8760h", // 1 year
        });
        if (error) throw error;
        result = { ok: true, message: "Utilizador suspenso" };
        break;
      }
      case "unban_user": {
        if (!target_user_id) throw new Error("target_user_id required");
        const { error } = await adminClient.auth.admin.updateUserById(target_user_id, {
          ban_duration: "none",
        });
        if (error) throw error;
        result = { ok: true, message: "Utilizador reativado" };
        break;
      }
      case "delete_user": {
        if (!target_user_id) throw new Error("target_user_id required");
        const { error } = await adminClient.auth.admin.deleteUser(target_user_id);
        if (error) throw error;
        result = { ok: true, message: "Utilizador eliminado" };
        break;
      }
      case "get_user_activity": {
        if (!target_user_id) throw new Error("target_user_id required");
        const [shops, audit] = await Promise.all([
          adminClient.from("shops").select("id, name, created_at, country, status").eq("user_id", target_user_id),
          adminClient.from("audit_logs").select("action, entity_type, created_at, details").eq("user_id", target_user_id).order("created_at", { ascending: false }).limit(50),
        ]);
        result = { ok: true, shops: shops.data, audit: audit.data };
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log the admin action
    await adminClient.from("audit_logs").insert({
      user_id: userData.user.id,
      action: `admin_${action}`,
      entity_type: "user",
      entity_id: target_user_id || null,
      details: { target_email, payload },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
