import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const password = url.searchParams.get("password") || null;

    // Input validation - token must be UUID format
    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password && (typeof password !== "string" || password.length > 100)) {
      return new Response(JSON.stringify({ error: "Mot de passe invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project by share_token
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

    // Check password
    if (project.share_password) {
      if (!password || password !== project.share_password) {
        return new Response(JSON.stringify({ error: "password_required", needs_password: true }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Remove password from response
    const { share_password: _, ...projectData } = project;

    // Get phases
    const { data: phases } = await supabase
      .from("phases")
      .select("id, name, sort_order")
      .eq("project_id", project.id)
      .order("sort_order");

    // Get tasks
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

    // Get subtasks
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

    // Get explanations
    let explanations: any[] = [];
    if (taskIds.length > 0) {
      const { data: te } = await supabase
        .from("task_explanations")
        .select("task_id, subtask_id, explanation")
        .or(`task_id.in.(${taskIds.join(",")}),subtask_id.in.(${(subtasks || []).map((s: any) => s.id).join(",") || "00000000-0000-0000-0000-000000000000"})`);
      explanations = te || [];
    }

    // Get team recommendations
    const { data: recommendations } = await supabase
      .from("team_recommendations")
      .select("id, role, description, importance, skills, estimated_monthly_cost, sort_order")
      .eq("project_id", project.id)
      .order("sort_order");

    // Get alternatives
    const recIds = (recommendations || []).map((r: any) => r.id);
    let alternatives: any[] = [];
    if (recIds.length > 0) {
      const { data: alts } = await supabase
        .from("recommendation_alternatives")
        .select("*")
        .in("recommendation_id", recIds);
      alternatives = alts || [];
    }

    // Build structured response
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
