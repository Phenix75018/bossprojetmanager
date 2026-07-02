// Auto-sync KPI fields (CAC, LTV, EBITDA margin, gross margin, fixed costs,
// annual revenue, breakeven) into the active scenario and business_assumptions
// after a generation completes. Populates the ScenarioComparison view without
// requiring manual entry.

import { supabase } from "@/integrations/supabase/client";
import type { BusinessAssumptions } from "@/lib/businessAssumptions";

// -----------------------------------------------------------------------
// Budget-line inference
// -----------------------------------------------------------------------

export type BudgetLineLite = {
  category: string;
  label?: string;
  subcategory?: string;
  monthly_values: number[] | unknown;
  is_total?: boolean;
};

function sumArr(a: unknown): number {
  if (!Array.isArray(a)) return 0;
  return a.reduce((s: number, v) => s + (Number(v) || 0), 0);
}

function sliceAnnual(a: unknown, months = 12): number {
  if (!Array.isArray(a)) return 0;
  return a
    .slice(0, months)
    .reduce((s: number, v) => s + (Number(v) || 0), 0);
}

function monthlyAvg(a: unknown, months = 12): number {
  if (!Array.isArray(a) || a.length === 0) return 0;
  const n = Math.min(a.length, months);
  return sliceAnnual(a, months) / (n || 1);
}

function isCOGS(l: BudgetLineLite): boolean {
  const s = `${l.subcategory || ""} ${l.label || ""}`.toLowerCase();
  return /achat|matièr|matiere|marchandis|cogs|coût des vent|cout des vent|prestation externe/.test(
    s,
  );
}

export function kpisFromBudgetLines(
  lines: BudgetLineLite[],
  horizonMonths = 12,
): Partial<BusinessAssumptions> {
  const months = Math.min(horizonMonths || 12, 12);
  const kept = lines.filter((l) => !l?.is_total);

  const revenueLines = kept.filter((l) => l.category === "revenue");
  const fixedLines = kept.filter((l) => l.category === "fixed_charges");
  const variableLines = kept.filter((l) => l.category === "variable_charges");

  const revenue = revenueLines.reduce(
    (s, l) => s + sliceAnnual(l.monthly_values, months),
    0,
  );
  const fixedMonthly =
    fixedLines.reduce((s, l) => s + monthlyAvg(l.monthly_values, months), 0);
  const variableAnnual = variableLines.reduce(
    (s, l) => s + sliceAnnual(l.monthly_values, months),
    0,
  );
  const cogsAnnual = variableLines
    .filter(isCOGS)
    .reduce((s, l) => s + sliceAnnual(l.monthly_values, months), 0);

  const out: Partial<BusinessAssumptions> = {};
  if (revenue > 0) out.expected_annual_revenue = Math.round(revenue);
  if (fixedMonthly > 0) out.fixed_costs_monthly = Math.round(fixedMonthly);

  if (revenue > 0) {
    const cogs = cogsAnnual > 0 ? cogsAnnual : variableAnnual;
    if (cogs >= 0) {
      const gm = ((revenue - cogs) / revenue) * 100;
      if (Number.isFinite(gm)) out.gross_margin_pct = Math.round(gm * 10) / 10;
    }
    const ebitda = revenue - fixedMonthly * 12 - variableAnnual;
    const em = (ebitda / revenue) * 100;
    if (Number.isFinite(em)) out.ebitda_margin_pct = Math.round(em * 10) / 10;
  }
  return out;
}

// -----------------------------------------------------------------------
// Text-based inference (BP / BM sections) — pulls CAC / LTV / margins /
// breakeven / annual revenue if the AI mentions them explicitly.
// -----------------------------------------------------------------------

// Parse a numeric expression like "1 250,50", "1,250.50", "12.5k", "3M", "3 M€".
function parseNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/[€$£¥\s]/g, "");
  let mult = 1;
  if (/[km]$/.test(s)) {
    mult = s.endsWith("m") ? 1_000_000 : 1_000;
    s = s.slice(0, -1);
  }
  // Handle FR/EN decimal separators.
  if (s.includes(",") && s.includes(".")) {
    // Assume "," is thousands.
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]) : null;
}

const NUM = "([0-9]+(?:[.,\\s][0-9]+)*\\s*[km]?)";

export function kpisFromText(text: string): Partial<BusinessAssumptions> {
  if (!text || typeof text !== "string") return {};
  const t = text.replace(/\s+/g, " ");
  const out: Partial<BusinessAssumptions> = {};

  const cac = firstMatch(
    t,
    new RegExp(`\\bcac\\b[^0-9]{0,40}${NUM}\\s*(?:€|eur|\\$|usd)?`, "i"),
  );
  if (cac) {
    const n = parseNumber(cac);
    if (n !== null && n > 0 && n < 1_000_000) out.avg_cac = Math.round(n);
  }

  const ltv = firstMatch(
    t,
    new RegExp(`\\bltv\\b[^0-9]{0,40}${NUM}\\s*(?:€|eur|\\$|usd)?`, "i"),
  );
  if (ltv) {
    const n = parseNumber(ltv);
    if (n !== null && n > 0 && n < 10_000_000) out.avg_ltv = Math.round(n);
  }

  const gm = firstMatch(
    t,
    /marge\s+brute[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]+)?)\s*%/i,
  );
  if (gm) {
    const n = parseNumber(gm);
    if (n !== null && n >= 0 && n <= 100) out.gross_margin_pct = n;
  }

  const em = firstMatch(
    t,
    /(?:marge\s+ebitda|ebitda\s+margin)[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]+)?)\s*%/i,
  );
  if (em) {
    const n = parseNumber(em);
    if (n !== null && n >= -100 && n <= 100) out.ebitda_margin_pct = n;
  }

  return out;
}

// -----------------------------------------------------------------------
// Persist to project (active scenario + business_assumptions).
// -----------------------------------------------------------------------

export async function syncKpisToProject(
  projectId: string | null | undefined,
  patch: Partial<BusinessAssumptions>,
): Promise<boolean> {
  if (!projectId) return false;
  const clean: Partial<BusinessAssumptions> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    (clean as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(clean).length === 0) return false;

  const { data, error } = await supabase
    .from("projects")
    .select("business_assumptions, assumption_scenarios, active_scenario")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const active: string = row.active_scenario || "base";
  const scenarios: Record<
    string,
    BusinessAssumptions & { label?: string }
  > = row.assumption_scenarios || {};
  const current: BusinessAssumptions = row.business_assumptions || {};

  const nextScenario = { ...(scenarios[active] || {}), ...clean };
  const nextScenarios = { ...scenarios, [active]: nextScenario };
  const nextAssumptions = { ...current, ...clean };

  const { error: upErr } = await supabase
    .from("projects")
    .update({
      business_assumptions: nextAssumptions as never,
      assumption_scenarios: nextScenarios as never,
    })
    .eq("id", projectId);
  return !upErr;
}

// -----------------------------------------------------------------------
// Convenience entry points invoked by the detail pages.
// -----------------------------------------------------------------------

export async function syncKpisFromBudget(
  projectId: string | null | undefined,
  lines: BudgetLineLite[],
  horizonMonths = 12,
): Promise<void> {
  const patch = kpisFromBudgetLines(lines || [], horizonMonths);
  await syncKpisToProject(projectId, patch);
}

export async function syncKpisFromTexts(
  projectId: string | null | undefined,
  texts: (string | undefined | null)[],
): Promise<void> {
  const merged: Partial<BusinessAssumptions> = {};
  for (const t of texts) {
    if (!t) continue;
    Object.assign(merged, kpisFromText(String(t)));
  }
  await syncKpisToProject(projectId, merged);
}
