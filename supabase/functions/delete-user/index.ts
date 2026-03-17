import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (callerRole?.role !== "super_admin" && callerRole?.role !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { user_id } = await req.json();
    if (!user_id || user_id === caller.id) {
      return new Response(JSON.stringify({ error: "User tidak valid" }), { status: 400, headers: corsHeaders });
    }

    const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user_id).single();
    const { data: targetProfile } = await supabaseAdmin.from("profiles").select("id, owner_id").eq("id", user_id).single();

    if (!targetRole) {
      return new Response(JSON.stringify({ error: "User tidak ditemukan" }), { status: 404, headers: corsHeaders });
    }

    if (callerRole.role === "owner") {
      if (["super_admin", "owner"].includes(targetRole.role)) {
        return new Response(JSON.stringify({ error: "Owner hanya bisa menghapus user di bawah tenantnya" }), { status: 403, headers: corsHeaders });
      }
      if (targetProfile?.owner_id !== caller.id) {
        return new Response(JSON.stringify({ error: "User ini bukan milik owner ini" }), { status: 403, headers: corsHeaders });
      }
    }

    await supabaseAdmin.from("data_entries").update({ created_by: null } as any).eq("created_by", user_id);
    await supabaseAdmin.from("data_entries").update({ pic_user_id: null } as any).eq("pic_user_id", user_id);
    await supabaseAdmin.from("data_entries").update({ umkm_user_id: null } as any).eq("umkm_user_id", user_id);
    await supabaseAdmin.from("audit_logs").update({ changed_by: null } as any).eq("changed_by", user_id);

    await supabaseAdmin.from("commissions").delete().eq("user_id", user_id);
    await supabaseAdmin.from("disbursements").delete().eq("user_id", user_id);
    await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);
    await supabaseAdmin.from("group_members").delete().eq("user_id", user_id);
    await supabaseAdmin.from("shared_links").delete().eq("user_id", user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
