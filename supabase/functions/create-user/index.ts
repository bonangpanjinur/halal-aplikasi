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
      // If an owner is creating a user, that user is automatically owned by the caller
      targetOwnerId = caller.id;
    } else if (actorRole === "super_admin") {
      if (targetRole === "owner") {
        // If a super admin creates an owner, the owner is their own owner (self-owned)
        // We'll set this after the user is created and we have their ID
        targetOwnerId = null; 
      } else {
        // If a super admin creates a non-owner user, they MUST specify an owner
        targetOwnerId = owner_id || null;
        if (!targetOwnerId) {
          return new Response(JSON.stringify({ error: "Owner wajib dipilih untuk role ini" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Assign role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: targetRole });
    if (roleError) {
      console.error("Role assignment error:", roleError);
      // Attempt to cleanup the created user if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `Gagal menetapkan role: ${roleError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Finalize owner_id: if the new user is an owner, they own themselves
    const finalOwnerId = targetRole === "owner" ? newUserId : targetOwnerId;

    // Create/Update profile
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name: normalizedName,
      email: normalizedEmail,
      owner_id: finalOwnerId,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Non-fatal for the response, but logged
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: { id: newUserId, email: normalizedEmail },
      message: "User berhasil dibuat dan ditautkan ke owner" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in create-user Edge Function:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
