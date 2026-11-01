import { supabase } from "@/integrations/supabase/client";
import { orderedSections, type MarketStudyConfig, type MarketStudySection } from "./marketStudy";

/** Hours of work per section depending on depth. */
export const HOURS_BY_DEPTH: Record<MarketStudyConfig["depth"], number> = { standard: 2, approfondie: 4, experte: 6 };
/** External costs (data, fieldwork) added on top of analyst time for some sections. */
export const EXTRA_COST: Record<string, number> = { market_sizing: 500, competition: 300, survey: 1500, regulation: 200 };
export const DEFAULT_HOURLY_RATE = 80;

export function sectionCost(key: string, config: MarketStudyConfig) {
  const rate = config.hourlyRate ?? DEFAULT_HOURLY_RATE;
  return HOURS_BY_DEPTH[config.depth] * rate + (EXTRA_COST[key] ?? 0);
}

const tagOf = (key: string) => `market-study:${key}`;

/**
 * Mirrors a market study into a project (phase + one task per section + budget lines),
 * so it shows up in Suivi live and the calendar like any project. Returns the project id.
 */
export async function syncStudyToTracking(opts: {
  studyId: string; userId: string; projectId: string | null; title: string; description: string;
  config: MarketStudyConfig; sections: MarketStudySection[];
}) {
  const { studyId, userId, title, description, config, sections } = opts;
  let projectId = opts.projectId;
  if (!projectId) {
    const { data, error } = await supabase.from("projects")
      .insert({ user_id: userId, title: `Étude de marché — ${title}`, description: description || title, status: "halfway" })
      .select("id").single();
    if (error) throw error;
    projectId = data.id;
    await supabase.from("market_studies").update({ project_id: projectId }).eq("id", studyId);
  }

  // Phase
  let { data: phase } = await supabase.from("phases").select("id").eq("project_id", projectId).eq("name", "Étude de marché").maybeSingle();
  if (!phase) {
    const r = await supabase.from("phases").insert({ project_id: projectId, name: "Étude de marché", sort_order: 0 }).select("id").single();
    if (r.error) throw r.error;
    phase = r.data;
  }

  // Tasks
  const wanted = orderedSections(config.sections);
  const { data: existing } = await supabase.from("tasks").select("id,tags,status").eq("phase_id", phase.id);
  const byKey = new Map((existing ?? []).map((t) => [(t.tags ?? []).find((x: string) => x.startsWith("market-study:")), t]));
  const hours = HOURS_BY_DEPTH[config.depth];
  for (const [i, s] of wanted.entries()) {
    const written = sections.some((x) => x.key === s.key && x.content.trim());
    const row = {
      title: s.title, description: s.brief, duration_hours: hours, sort_order: i,
      priority: i < 4 ? "P0" : i < 10 ? "P1" : "P2",
      status: written ? "done" : "todo", tags: [tagOf(s.key), "étude-de-marché"],
    };
    const t = byKey.get(tagOf(s.key));
    if (t) await supabase.from("tasks").update(row).eq("id", t.id);
    else await supabase.from("tasks").insert({ ...row, phase_id: phase.id });
  }
  const removed = (existing ?? []).filter((t) => {
    const k = (t.tags ?? []).find((x: string) => x.startsWith("market-study:"))?.slice(13);
    return k && !wanted.some((w) => w.key === k);
  });
  if (removed.length) await supabase.from("tasks").delete().in("id", removed.map((t) => t.id));

  // Budget: one cost line per task
  const budgetTitle = `Budget — Étude de marché ${title}`;
  let { data: budget } = await supabase.from("budgets").select("id").eq("project_id", projectId).eq("title", budgetTitle).maybeSingle();
  if (!budget) {
    const r = await supabase.from("budgets").insert({ user_id: userId, project_id: projectId, title: budgetTitle, horizon_months: 12 }).select("id").single();
    if (r.error) throw r.error;
    budget = r.data;
  }
  await supabase.from("budget_lines").delete().eq("budget_id", budget.id);
  const lines = wanted.map((s, i) => {
    const months = Array(12).fill(0);
    months[Math.min(11, Math.floor(i / 4))] = sectionCost(s.key, config);
    return { budget_id: budget!.id, category: "expenses", subcategory: "Étude de marché", label: s.title, monthly_values: months, is_total: false, sort_order: i };
  });
  if (lines.length) await supabase.from("budget_lines").insert(lines);

  const done = wanted.filter((s) => sections.some((x) => x.key === s.key && x.content.trim())).length;
  await supabase.from("projects").update({ completion_percent: wanted.length ? Math.round((done / wanted.length) * 100) : 0 }).eq("id", projectId);
  return projectId;
}
