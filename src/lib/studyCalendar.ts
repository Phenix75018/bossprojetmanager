import { DEFAULT_CONFIG, completion, orderedSections, type MarketStudyConfig, type MarketStudySection } from "./marketStudy";
import { HOURS_BY_DEPTH, sectionCost } from "./marketStudyTracking";
import type { ProjectWithDetails } from "@/hooks/useProjectsDB";

/** A row of the market_studies table. */
export interface StudyRow {
  id: string;
  title: string;
  description: string;
  status: string;
  config: Partial<MarketStudyConfig> | null;
  sections: MarketStudySection[] | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyBudget {
  budget: number;
  spent: number;
  hours: number;
  pendingHours: number;
  sectionsWanted: number;
  sectionsWritten: number;
}

export interface StudyTimeline extends StudyBudget {
  study: StudyRow;
  cfg: MarketStudyConfig;
  pct: number;
  /** Local day key (yyyy-MM-dd) of the study creation. */
  start: string;
  /** Local day key of the planned finish, or the real one when everything is written. */
  end: string | null;
  /** First day still to work on, today or later. */
  nextDate: string | null;
  planned: boolean;
}

/** Local yyyy-MM-dd for a date, matching how the calendar keys its days. */
export function toDayKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Money + hours of a study: analyst time per section plus external costs. */
export function studyBudget(study: StudyRow): StudyBudget {
  const cfg = { ...DEFAULT_CONFIG, ...(study.config ?? {}) } as MarketStudyConfig;
  const wanted = orderedSections(cfg.sections);
  const writtenKeys = new Set((study.sections ?? []).filter((s) => s.content?.trim()).map((s) => s.key));
  let budget = 0;
  let spent = 0;
  for (const s of wanted) {
    const cost = sectionCost(s.key, cfg);
    budget += cost;
    if (writtenKeys.has(s.key)) spent += cost;
  }
  const perSection = HOURS_BY_DEPTH[cfg.depth] ?? 0;
  const writtenCount = wanted.filter((s) => writtenKeys.has(s.key)).length;
  return {
    budget,
    spent,
    hours: wanted.length * perSection,
    pendingHours: (wanted.length - writtenCount) * perSection,
    sectionsWanted: wanted.length,
    sectionsWritten: writtenCount,
  };
}

/**
 * Study plan: creation day, planned finish (from the pending tasks dispatched by the
 * calendar engine) and the first day still to come.
 * `pendingKeys` are the day keys returned by dispatchTasks for the mirrored project.
 */
export function buildTimeline(study: StudyRow, pendingKeys: string[]): StudyTimeline {
  const cfg = { ...DEFAULT_CONFIG, ...(study.config ?? {}) } as MarketStudyConfig;
  const sections = study.sections ?? [];
  const keys = [...pendingKeys].sort();
  const today = toDayKey(new Date());
  const written = sections.filter((s) => s.content?.trim() && s.generated_at);
  const lastWritten = written.length ? written.map((s) => toDayKey(s.generated_at!)).sort().pop()! : null;
  return {
    ...studyBudget(study),
    study,
    cfg,
    pct: completion(cfg, sections),
    start: toDayKey(study.created_at),
    end: keys.length ? keys[keys.length - 1] : lastWritten ?? toDayKey(study.updated_at),
    nextDate: keys.find((k) => k >= today) ?? null,
    planned: Boolean(study.project_id),
  };
}

/** Monthly spread of the study cost, same distribution as the mirrored budget lines. */
export function studyMonthly(study: StudyRow): { planned: number[]; spent: number[] } {
  const cfg = { ...DEFAULT_CONFIG, ...(study.config ?? {}) } as MarketStudyConfig;
  const planned = Array(12).fill(0);
  const spent = Array(12).fill(0);
  const writtenKeys = new Set((study.sections ?? []).filter((s) => s.content?.trim()).map((s) => s.key));
  orderedSections(cfg.sections).forEach((s, i) => {
    const month = Math.min(11, Math.floor(i / 4));
    const cost = sectionCost(s.key, cfg);
    planned[month] += cost;
    if (writtenKeys.has(s.key)) spent[month] += cost;
  });
  return { planned, spent };
}

/** One virtual project holding every study's tasks, for the shared calendar view. */
export function mergeStudyProjects(entries: { project: ProjectWithDetails; studyTitle: string }[]): ProjectWithDetails | null {
  if (entries.length === 0) return null;
  const base = entries[0].project;
  return {
    ...base,
    id: "all-studies",
    title: "Toutes les études",
    phases: entries.flatMap((e) =>
      e.project.phases.map((phase) => ({ ...phase, name: `${e.studyTitle} — ${phase.name}` })),
    ),
  };
}
