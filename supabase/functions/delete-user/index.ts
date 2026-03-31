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

    const body = await req.json();
    const userIds = Array.isArray(body.user_id) ? body.user_id : [body.user_id];
    
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ error: "User tidak valid" }), { status: 400, headers: corsHeaders });
    }

    const results = [];
    for (const user_id of userIds) {
      if (!user_id || user_id === caller.id) {
        results.push({ user_id, error: "User tidak valid atau tidak bisa menghapus diri sendiri" });
        continue;
      }

      const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
      const { data: targetProfile } = await supabaseAdmin.from("profiles").select("id, owner_id").eq("id", user_id).maybeSingle();

      if (!targetRole && !targetProfile) {
        results.push({ user_id, error: "User tidak ditemukan" });
        continue;
      }

      if (callerRole.role === "owner") {
        if (targetRole && ["super_admin", "owner"].includes(targetRole.role)) {
          results.push({ user_id, error: "Owner hanya bisa menghapus user di bawah tenantnya" });
          continue;
        }
        if (targetProfile?.owner_id !== caller.id) {
          results.push({ user_id, error: "User ini bukan milik owner ini" });
          continue;
        }
      }

      try {
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
          results.push({ user_id, error: error.message });
        } else {
          results.push({ user_id, success: true });
        }
      } catch (e) {
        results.push({ user_id, error: (e as Error).message });
      }
    }

    const hasError = results.some(r => r.error);
    const allFailed = results.every(r => r.error);

    return new Response(
      JSON.stringify({ 
        success: !allFailed, 
        results,
        message: allFailed ? "Gagal menghapus semua user" : (hasError ? "Beberapa user gagal dihapus" : "Semua user berhasil dihapus")
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: allFailed ? 400 : 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
