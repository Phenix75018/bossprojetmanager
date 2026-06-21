import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let token: string | null = null;
    let password: string | null = null;
    try {
      const body = await req.json();
      token = typeof body?.token === "string" ? body.token : null;
      password = typeof body?.password === "string" ? body.password : null;
    } catch {
      // Fall through to validation error below.
    }

    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password !== null && password.length > 200) {
      return new Response(JSON.stringify({ error: "Mot de passe invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: share, error: shareErr } = await supabase
      .from("calendar_shares")
      .select("user_id, share_password")
      .eq("share_token", token)
      .single();

    if (shareErr || !share) {
      return new Response(JSON.stringify({ error: "Calendrier introuvable ou non partagé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (share.share_password) {
      if (!password) {
        return new Response(JSON.stringify({ error: "password_required", needs_password: true }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ok, error: vErr } = await supabase.rpc("verify_share_password", {
        plain_password: password,
        hashed_password: share.share_password,
      });
      if (vErr || !ok) {
        return new Response(JSON.stringify({ error: "password_required", needs_password: true }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userId = share.user_id;

    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, description, days_per_week, time_slots, hours_per_week")
      .eq("user_id", userId);

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ projects: [], phases: [], tasks: [], subtasks: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectIds = projects.map((p: any) => p.id);

    const { data: phases } = await supabase
      .from("phases")
      .select("id, name, project_id, sort_order")
      .in("project_id", projectIds)
      .order("sort_order");

    const phaseIds = (phases || []).map((p: any) => p.id);

    let tasks: any[] = [];
    if (phaseIds.length > 0) {
      const { data: t } = await supabase
        .from("tasks")
        .select("id, title, description, priority, status, duration_hours, optional, phase_id, sort_order")
        .in("phase_id", phaseIds)
        .order("sort_order");
      tasks = t || [];
    }

    const taskIds = tasks.map((t: any) => t.id);
    let subtasks: any[] = [];
    if (taskIds.length > 0) {
      const { data: st } = await supabase
        .from("subtasks")
        .select("id, title, status, duration_hours, task_id, sort_order")
        .in("task_id", taskIds)
        .order("sort_order");
      subtasks = st || [];
    }

    return new Response(
      JSON.stringify({ projects, phases: phases || [], tasks, subtasks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
