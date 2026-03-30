import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OWNER_MANAGED_ROLES = ["admin", "admin_input", "lapangan", "nib", "umkm"];
const SUPER_ADMIN_MANAGED_ROLES = ["owner", ...OWNER_MANAGED_ROLES];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerRoleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).single();
    const actorRole = callerRoleData?.role;
    if (actorRole !== "super_admin" && actorRole !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { user_id, action, new_role, new_password, new_owner_id } = body;
    console.log("Update user request:", { user_id, action, actorRole, callerId: caller.id, new_owner_id });

    if (!user_id || user_id === caller.id) {
      return new Response(JSON.stringify({ error: "User tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate target user exists
    const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
    const { data: targetProfile } = await supabaseAdmin.from("profiles").select("id, owner_id").eq("id", user_id).maybeSingle();

    if (!targetRole && !targetProfile) {
      return new Response(JSON.stringify({ error: "User tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Owner scope check
    if (actorRole === "owner") {
      if (targetRole && ["super_admin", "owner"].includes(targetRole.role)) {
        return new Response(JSON.stringify({ error: "Tidak bisa mengubah user ini" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (targetProfile?.owner_id !== caller.id) {
        return new Response(JSON.stringify({ error: "User ini bukan milik owner ini" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // --- ACTION: change_role ---
    if (action === "change_role") {
      if (!new_role) {
        return new Response(JSON.stringify({ error: "Role baru wajib diisi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (targetRole?.role === "super_admin") {
        return new Response(JSON.stringify({ error: "Tidak bisa mengubah role super admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const allowedRoles = actorRole === "super_admin" ? SUPER_ADMIN_MANAGED_ROLES : OWNER_MANAGED_ROLES;
      if (!allowedRoles.includes(new_role)) {
        return new Response(JSON.stringify({ error: "Role tidak diizinkan" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Logic for owner_id assignment when role changes
      let finalOwnerId = targetProfile?.owner_id;
      if (new_role === "owner") {
        finalOwnerId = user_id;
      } else if (OWNER_MANAGED_ROLES.includes(new_role)) {
        if (actorRole === "owner") {
          finalOwnerId = caller.id;
        } else if (actorRole === "super_admin") {
          if (new_owner_id) {
            finalOwnerId = new_owner_id;
          } else if (!finalOwnerId || finalOwnerId === user_id) {
            return new Response(JSON.stringify({ error: "Role ini wajib memiliki owner. Silakan pilih owner." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } else if (new_role === "super_admin") {
        finalOwnerId = null;
      }

      // IMPORTANT: Update profile first to satisfy trigger when role is updated
      const { error: profileError } = await supabaseAdmin.from("profiles").update({ owner_id: finalOwnerId }).eq("id", user_id);
      if (profileError) {
        return new Response(JSON.stringify({ error: `Gagal update profil: ${profileError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (targetRole) {
        const { error } = await supabaseAdmin.from("user_roles").update({ role: new_role }).eq("user_id", user_id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { error } = await supabaseAdmin.from("user_roles").insert({ user_id, role: new_role });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, message: "Role berhasil diubah" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ACTION: reset_password ---
    if (action === "reset_password") {
      if (!new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Password minimal 6 karakter" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      return new Response(JSON.stringify({ success: true, message: "Password berhasil direset" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ACTION: change_owner ---
    if (action === "change_owner") {
      if (actorRole !== "super_admin") {
        return new Response(JSON.stringify({ error: "Hanya super admin yang bisa mengubah owner" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (targetRole?.role === "super_admin") {
        return new Response(JSON.stringify({ error: "Tidak bisa mengubah owner dari user ber-role super admin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (new_owner_id) {
        const { data: ownerRole, error: ownerCheckError } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", new_owner_id)
          .single();
        
        if (ownerCheckError || ownerRole?.role !== "owner") {
          return new Response(JSON.stringify({ error: "User target owner tidak valid atau tidak memiliki role owner" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        if (targetRole && OWNER_MANAGED_ROLES.includes(targetRole.role)) {
          return new Response(JSON.stringify({ error: "Role ini wajib memiliki owner dan tidak boleh kosong" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ owner_id: new_owner_id || null })
        .eq("id", user_id);

      if (profileError) {
        return new Response(JSON.stringify({ error: `Gagal update profile: ${profileError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin
        .from("groups")
        .update({ owner_id: new_owner_id || null })
        .eq("created_by", user_id);

      return new Response(JSON.stringify({ success: true, message: "Owner berhasil diperbarui dan relasi telah ditetapkan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Unhandled error in Edge Function:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
