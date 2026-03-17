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

    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).single();
    const actorRole = callerRole?.role;
    if (actorRole !== "super_admin" && actorRole !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, password, full_name, role, owner_id } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof full_name === "string" ? full_name.trim() : "";
    const targetRole = typeof role === "string" ? role : "";

    if (!normalizedEmail || !normalizedName || password?.length < 6) {
      return new Response(JSON.stringify({ error: "Data user tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allowedRoles = actorRole === "super_admin" ? SUPER_ADMIN_MANAGED_ROLES : OWNER_MANAGED_ROLES;
    if (!allowedRoles.includes(targetRole)) {
      return new Response(JSON.stringify({ error: "Role tidak diizinkan" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const targetOwnerId = actorRole === "owner"
      ? caller.id
      : targetRole === "owner"
        ? null
        : owner_id || null;

    if (actorRole === "super_admin" && targetRole !== "owner" && !targetOwnerId) {
      return new Response(JSON.stringify({ error: "Owner wajib dipilih untuk role ini" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: normalizedName },
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Gagal membuat user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: targetRole });
    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const profileOwnerId = targetRole === "owner" ? newUser.user.id : targetOwnerId;
    if (profileOwnerId) {
      await supabaseAdmin.from("profiles").update({ owner_id: profileOwnerId } as any).eq("id", newUser.user.id);
    }

    return new Response(JSON.stringify({ user: { id: newUser.user.id, email: normalizedEmail } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
