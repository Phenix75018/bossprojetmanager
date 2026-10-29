import { supabase } from "@/integrations/supabase/client";

export type DocType = "plan" | "business_plan" | "business_model" | "budget";

export const DOC_LABELS: Record<DocType, string> = {
  plan: "Plan d'action",
  business_plan: "Business plan",
  business_model: "Business model",
  budget: "Budget",
};

export async function captureKpis(projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("business_assumptions, assumption_scenarios, active_scenario")
    .eq("id", projectId)
    .maybeSingle();
  return data ? { projectId, ...data } : null;
}

/** Reads the current state of a document so it can be stored as a version. */
export async function buildDocSnapshot(type: DocType, docId: string): Promise<Record<string, unknown>> {
  if (type === "plan") {
    const { data: project } = await supabase.from("projects").select("title,description,deadline,hours_per_week,days_per_week").eq("id", docId).maybeSingle();
    const { data: phases } = await supabase.from("phases").select("id,name,sort_order").eq("project_id", docId).order("sort_order");
    const phaseIds = (phases ?? []).map(p => p.id);
    const { data: tasks } = phaseIds.length
      ? await supabase.from("tasks").select("id,phase_id,title,description,priority,status,duration_hours,dependencies,tags,notes,optional,sort_order").in("phase_id", phaseIds).order("sort_order")
      : { data: [] as any[] };
    const taskIds = (tasks ?? []).map(t => t.id);
    const { data: subtasks } = taskIds.length
      ? await supabase.from("subtasks").select("id,task_id,title,status,duration_hours,sort_order").in("task_id", taskIds).order("sort_order")
      : { data: [] as any[] };
    return {
      project,
      phases: (phases ?? []).map(p => ({
        ...p,
        tasks: (tasks ?? []).filter(t => t.phase_id === p.id).map(t => ({
          ...t,
          subtasks: (subtasks ?? []).filter(s => s.task_id === t.id),
        })),
      })),
    };
  }
  if (type === "business_plan") {
    const { data: plan } = await supabase.from("business_plans").select("*").eq("id", docId).maybeSingle();
    const { data: sections } = await supabase.from("business_plan_sections").select("section_type,title,content,sort_order").eq("business_plan_id", docId).order("sort_order");
    return { plan, sections: sections ?? [] };
  }
  if (type === "business_model") {
    const { data: model } = await supabase.from("business_models").select("*").eq("id", docId).maybeSingle();
    const { data: blocks } = await supabase.from("business_model_blocks").select("block_type,title,content,sort_order").eq("business_model_id", docId).order("sort_order");
    return { model, blocks: blocks ?? [] };
  }
  const { data: budget } = await supabase.from("budgets").select("*").eq("id", docId).maybeSingle();
  const { data: lines } = await supabase.from("budget_lines").select("category,subcategory,label,monthly_values,is_total,sort_order").eq("budget_id", docId).order("sort_order");
  return { budget, lines: lines ?? [] };
}

export async function saveDocVersion(userId: string, type: DocType, docId: string, projectId: string, label: string) {
  const snapshot = await buildDocSnapshot(type, docId);
  const { data: last } = await supabase.from("document_versions").select("version_number")
    .eq("document_type", type).eq("document_id", docId)
    .order("version_number", { ascending: false }).limit(1).maybeSingle();
  const kpis = await captureKpis(projectId);
  const { error } = await supabase.from("document_versions").insert({
    user_id: userId,
    document_type: type,
    document_id: docId,
    version_number: (last?.version_number ?? 0) + 1,
    label,
    snapshot: (kpis ? { ...snapshot, __kpis: kpis } : snapshot) as any,
  });
  if (error) throw error;
}

async function restorePlan(projectId: string, snap: any) {
  const phases: any[] = snap.phases ?? [];
  const keepPhase = new Set(phases.map(p => p.id));
  const keepTask = new Set(phases.flatMap(p => (p.tasks ?? []).map((t: any) => t.id)));
  const keepSub = new Set(phases.flatMap(p => (p.tasks ?? []).flatMap((t: any) => (t.subtasks ?? []).map((s: any) => s.id))));

  // Remove items that did not exist in this version (calendar links to kept tasks are preserved)
  const { data: curPhases } = await supabase.from("phases").select("id").eq("project_id", projectId);
  const curPhaseIds = (curPhases ?? []).map(p => p.id);
  const { data: curTasks } = curPhaseIds.length ? await supabase.from("tasks").select("id").in("phase_id", curPhaseIds) : { data: [] as any[] };
  const curTaskIds = (curTasks ?? []).map(t => t.id);
  const { data: curSubs } = curTaskIds.length ? await supabase.from("subtasks").select("id").in("task_id", curTaskIds) : { data: [] as any[] };
  const delSubs = (curSubs ?? []).map(s => s.id).filter(id => !keepSub.has(id));
  const delTasks = curTaskIds.filter(id => !keepTask.has(id));
  const delPhases = curPhaseIds.filter(id => !keepPhase.has(id));
  if (delSubs.length) await supabase.from("subtasks").delete().in("id", delSubs);
  if (delTasks.length) await supabase.from("tasks").delete().in("id", delTasks);
  if (delPhases.length) await supabase.from("phases").delete().in("id", delPhases);

  if (phases.length) {
    const { error } = await supabase.from("phases").upsert(phases.map(p => ({ id: p.id, project_id: projectId, name: p.name, sort_order: p.sort_order })));
    if (error) throw error;
  }
  const tasks = phases.flatMap(p => p.tasks ?? []);
  if (tasks.length) {
    const { error } = await supabase.from("tasks").upsert(tasks.map(({ subtasks, ...t }: any) => t));
    if (error) throw error;
  }
  const subs = tasks.flatMap((t: any) => t.subtasks ?? []);
  if (subs.length) {
    const { error } = await supabase.from("subtasks").upsert(subs);
    if (error) throw error;
  }
  if (snap.project) {
    await supabase.from("projects").update({
      title: snap.project.title, description: snap.project.description, deadline: snap.project.deadline,
      hours_per_week: snap.project.hours_per_week, days_per_week: snap.project.days_per_week,
    }).eq("id", projectId);
  }
}

async function replaceChildren(table: "business_plan_sections" | "business_model_blocks" | "budget_lines", fk: string, docId: string, rows: any[]) {
  await supabase.from(table).delete().eq(fk, docId);
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows.map((r, i) => ({ ...r, [fk]: docId, sort_order: r.sort_order ?? i })) as any);
  if (error) throw error;
}

/** Restores a document version (content + KPIs). Caller should save the current state first. */
export async function restoreDocVersion(type: DocType, docId: string, snapshot: any) {
  if (type === "plan") await restorePlan(docId, snapshot);
  else if (type === "business_plan") {
    await replaceChildren("business_plan_sections", "business_plan_id", docId, (snapshot.sections ?? []).map((s: any) => ({ ...s, generated: true })));
    await supabase.from("business_plans").update({ updated_at: new Date().toISOString() }).eq("id", docId);
  } else if (type === "business_model") {
    await replaceChildren("business_model_blocks", "business_model_id", docId, (snapshot.blocks ?? []).map((b: any) => ({ ...b, generated: true })));
    await supabase.from("business_models").update({ updated_at: new Date().toISOString() }).eq("id", docId);
  } else {
    await replaceChildren("budget_lines", "budget_id", docId, (snapshot.lines ?? []).map((l: any) => ({ ...l, subcategory: l.subcategory || "", is_total: !!l.is_total })));
    await supabase.from("budgets").update({ updated_at: new Date().toISOString() }).eq("id", docId);
  }
  const k = snapshot?.__kpis;
  if (k?.projectId) {
    await supabase.from("projects").update({
      business_assumptions: k.business_assumptions,
      assumption_scenarios: k.assumption_scenarios,
      active_scenario: k.active_scenario,
    }).eq("id", k.projectId);
  }
}
