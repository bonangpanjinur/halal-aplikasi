import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (callerRole?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all auth users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    // Get existing profiles
    const { data: existingProfiles } = await supabaseAdmin.from("profiles").select("id");
    const existingIds = new Set((existingProfiles ?? []).map((p: any) => p.id));

    // Get user roles
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));

    const created: string[] = [];
    for (const user of users) {
      if (existingIds.has(user.id)) continue;

      const userRole = roleMap.get(user.id);
      let ownerId: string | null = null;
      if (userRole === "owner") {
        ownerId = user.id;
      }

      const { error } = await supabaseAdmin.from("profiles").insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || "",
        email: user.email || "",
        owner_id: ownerId,
      });

      if (!error) {
        created.push(user.email || user.id);
      } else {
        console.error(`Failed: ${user.email}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({ message: `Backfilled ${created.length} profiles`, created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
