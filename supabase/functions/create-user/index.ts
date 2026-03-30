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
    const { email, password, full_name, role, owner_id } = body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof full_name === "string" ? full_name.trim() : "";
    const targetRole = typeof role === "string" ? role : "";

    console.log("Create user request:", { email: normalizedEmail, role: targetRole, actorRole, callerId: caller.id, owner_id });

    if (!normalizedEmail || !normalizedName || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Data user tidak valid (email, nama, dan password minimal 6 karakter wajib diisi)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allowedRoles = actorRole === "super_admin" ? SUPER_ADMIN_MANAGED_ROLES : OWNER_MANAGED_ROLES;
    if (!allowedRoles.includes(targetRole)) {
      return new Response(JSON.stringify({ error: `Role '${targetRole}' tidak diizinkan untuk role anda` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine the owner_id for the new user
    let targetOwnerId = null;
    if (actorRole === "owner") {
      targetOwnerId = caller.id;
    } else if (actorRole === "super_admin") {
      if (targetRole === "owner") {
        targetOwnerId = null; 
      } else {
        targetOwnerId = owner_id || null;
        if (!targetOwnerId) {
          return new Response(JSON.stringify({ error: "Owner wajib dipilih untuk role ini agar terelasi dengan benar" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Create the user in Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: normalizedName },
    });

    if (createError || !newUser.user) {
      console.error("Auth user creation error:", createError);
      return new Response(JSON.stringify({ error: createError?.message || "Gagal membuat user di sistem autentikasi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newUserId = newUser.user.id;

    // IMPORTANT: Reorder operations to satisfy database triggers
    // 1. Create Profile first (without role check trigger firing yet because role is null)
    const finalOwnerId = targetRole === "owner" ? newUserId : targetOwnerId;
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name: normalizedName,
      email: normalizedEmail,
      owner_id: finalOwnerId,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `Gagal membuat profil: ${profileError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Assign role (trigger will now pass because profile with owner_id already exists)
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: targetRole });
    if (roleError) {
      console.error("Role assignment error:", roleError);
      // Cleanup
      await supabaseAdmin.from("profiles").delete().eq("id", newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `Gagal menetapkan role: ${roleError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: { id: newUserId, email: normalizedEmail },
      message: `User berhasil dibuat dan ditautkan ke owner ${targetRole === "owner" ? "dirinya sendiri" : "terpilih"}` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in create-user Edge Function:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
