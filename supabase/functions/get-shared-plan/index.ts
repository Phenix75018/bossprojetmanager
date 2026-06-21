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
    // Read from JSON body (POST) — never accept passwords via URL query params.
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

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, title, description, completion_percent, project_type, deadline, status, share_password")
      .eq("share_token", token)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Plan introuvable ou non partagé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (project.share_password) {
      if (!password) {
        return new Response(JSON.stringify({ error: "password_required", needs_password: true }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ok, error: vErr } = await supabase.rpc("verify_share_password", {
        plain_password: password,
        hashed_password: project.share_password,
      });
      if (vErr || !ok) {
        return new Response(JSON.stringify({ error: "password_required", needs_password: true }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { share_password: _, ...projectData } = project;

    const { data: phases } = await supabase
      .from("phases")
      .select("id, name, sort_order")
      .eq("project_id", project.id)
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

    let explanations: any[] = [];
    if (taskIds.length > 0) {
      const { data: te } = await supabase
        .from("task_explanations")
        .select("task_id, subtask_id, explanation")
        .or(`task_id.in.(${taskIds.join(",")}),subtask_id.in.(${(subtasks || []).map((s: any) => s.id).join(",") || "00000000-0000-0000-0000-000000000000"})`);
      explanations = te || [];
    }

    const { data: recommendations } = await supabase
      .from("team_recommendations")
      .select("id, role, description, importance, skills, estimated_monthly_cost, sort_order")
      .eq("project_id", project.id)
      .order("sort_order");

    const recIds = (recommendations || []).map((r: any) => r.id);
    let alternatives: any[] = [];
    if (recIds.length > 0) {
      const { data: alts } = await supabase
        .from("recommendation_alternatives")
        .select("*")
        .in("recommendation_id", recIds);
      alternatives = alts || [];
    }

    const structuredPhases = (phases || []).map((phase: any) => ({
      ...phase,
      tasks: tasks
        .filter((t: any) => t.phase_id === phase.id)
        .map((task: any) => ({
          ...task,
          subtasks: subtasks.filter((st: any) => st.task_id === task.id),
        })),
    }));

    return new Response(
      JSON.stringify({
        project: projectData,
        phases: structuredPhases,
        explanations,
        recommendations: recommendations || [],
        alternatives,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
