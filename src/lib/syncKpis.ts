// Auto-sync KPI fields (CAC, LTV, EBITDA margin, gross margin, fixed costs,
// annual revenue, breakeven) into the active scenario and business_assumptions
// after a generation completes. Populates the ScenarioComparison view without
// requiring manual entry.
//
// Every inferred KPI also records the source data (budget lines aggregated or
// textual snippet extracted) so the comparison UI can explain how the value
// was calculated.

import { supabase } from "@/integrations/supabase/client";
import type { BusinessAssumptions } from "@/lib/businessAssumptions";

// -----------------------------------------------------------------------
// Source metadata attached to each KPI
// -----------------------------------------------------------------------

export type KpiContributor = {
  label: string;
  value?: number | string;
  snippet?: string;
  href?: string;
  hrefLabel?: string;
};

export type KpiSource = {
  origin: "budget" | "text" | "manual";
  formula?: string;
  contributors?: KpiContributor[];
  href?: string;
  hrefLabel?: string;
};

export type KpiSources = Partial<Record<keyof BusinessAssumptions, KpiSource>>;

// Manual locks: when set to true for a given KPI on a scenario, the auto-sync
// leaves that KPI (and its source metadata) untouched so the user's custom
// value survives future generations.
export type KpiLocks = Partial<Record<keyof BusinessAssumptions, boolean>>;

// Fields users can lock in the comparison view.
export const LOCKABLE_KPI_KEYS: (keyof BusinessAssumptions)[] = [
  "expected_annual_revenue",
  "fixed_costs_monthly",
  "gross_margin_pct",
  "ebitda_margin_pct",
  "avg_cac",
  "avg_ltv",
  "growth_rate_pct",
  "market_share_target_pct",
];

export type KpiResult = {
  patch: Partial<BusinessAssumptions>;
  sources: KpiSources;
};

// -----------------------------------------------------------------------
// Budget-line inference
// -----------------------------------------------------------------------

export type BudgetLineLite = {
  id?: string;
  category: string;
  label?: string;
  subcategory?: string;
  monthly_values: number[] | unknown;
  is_total?: boolean;
};

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

function lineLabel(l: BudgetLineLite): string {
  return l.label || l.subcategory || l.category || "Ligne";
}

function budgetLineHref(budgetId: string | undefined, l: BudgetLineLite): string | undefined {
  if (!budgetId) return undefined;
  const cat = encodeURIComponent(l.category || "");
  if (l.id) return `/budget/${budgetId}?category=${cat}&line=${encodeURIComponent(l.id)}`;
  return `/budget/${budgetId}?category=${cat}`;
}

function categoryHref(budgetId: string | undefined, category: string): string | undefined {
  if (!budgetId) return undefined;
  return `/budget/${budgetId}?category=${encodeURIComponent(category)}`;
}

export type BudgetSyncOpts = { budgetId?: string };

export function kpisFromBudgetLines(
  lines: BudgetLineLite[],
  horizonMonths = 12,
  opts: BudgetSyncOpts = {},
): KpiResult {
  const months = Math.min(horizonMonths || 12, 12);
  const kept = (lines || []).filter((l) => !l?.is_total);

  const revenueLines = kept.filter((l) => l.category === "revenue");
  const fixedLines = kept.filter((l) => l.category === "fixed_charges");
  const variableLines = kept.filter((l) => l.category === "variable_charges");
  const cogsLines = variableLines.filter(isCOGS);

  const revenue = revenueLines.reduce(
    (s, l) => s + sliceAnnual(l.monthly_values, months),
    0,
  );
  const fixedMonthly = fixedLines.reduce(
    (s, l) => s + monthlyAvg(l.monthly_values, months),
    0,
  );
  const variableAnnual = variableLines.reduce(
    (s, l) => s + sliceAnnual(l.monthly_values, months),
    0,
  );
  const cogsAnnual = cogsLines.reduce(
    (s, l) => s + sliceAnnual(l.monthly_values, months),
    0,
  );

  const patch: Partial<BusinessAssumptions> = {};
  const sources: KpiSources = {};

  const bId = opts.budgetId;

  if (revenue > 0) {
    patch.expected_annual_revenue = Math.round(revenue);
    sources.expected_annual_revenue = {
      origin: "budget",
      formula: `Somme des lignes « Revenus » sur ${months} mois`,
      href: categoryHref(bId, "revenue"),
      hrefLabel: "Ouvrir la catégorie « Revenus »",
      contributors: revenueLines.map((l) => ({
        label: lineLabel(l),
        value: Math.round(sliceAnnual(l.monthly_values, months)),
        href: budgetLineHref(bId, l),
        hrefLabel: "Voir la ligne",
      })),
    };
  }

  if (fixedMonthly > 0) {
    patch.fixed_costs_monthly = Math.round(fixedMonthly);
    sources.fixed_costs_monthly = {
      origin: "budget",
      formula: `Moyenne mensuelle des lignes « Charges fixes » sur ${months} mois`,
      href: categoryHref(bId, "fixed_charges"),
      hrefLabel: "Ouvrir la catégorie « Charges fixes »",
      contributors: fixedLines.map((l) => ({
        label: lineLabel(l),
        value: Math.round(monthlyAvg(l.monthly_values, months)),
        href: budgetLineHref(bId, l),
        hrefLabel: "Voir la ligne",
      })),
    };
  }

  if (revenue > 0) {
    const cogs = cogsAnnual > 0 ? cogsAnnual : variableAnnual;
    const gm = ((revenue - cogs) / revenue) * 100;
    if (Number.isFinite(gm)) {
      patch.gross_margin_pct = Math.round(gm * 10) / 10;
      const contribLines = cogsAnnual > 0 ? cogsLines : variableLines;
      sources.gross_margin_pct = {
        origin: "budget",
        formula: `(CA − ${cogsAnnual > 0 ? "COGS" : "charges variables"}) ÷ CA = (${Math.round(revenue)} − ${Math.round(cogs)}) ÷ ${Math.round(revenue)}`,
        href: categoryHref(bId, "variable_charges"),
        hrefLabel: "Ouvrir la catégorie « Charges variables »",
        contributors: contribLines.map((l) => ({
          label: lineLabel(l),
          value: Math.round(sliceAnnual(l.monthly_values, months)),
          href: budgetLineHref(bId, l),
          hrefLabel: "Voir la ligne",
        })),
      };
    }
    const ebitda = revenue - fixedMonthly * 12 - variableAnnual;
    const em = (ebitda / revenue) * 100;
    if (Number.isFinite(em)) {
      patch.ebitda_margin_pct = Math.round(em * 10) / 10;
      sources.ebitda_margin_pct = {
        origin: "budget",
        formula: `(CA − charges fixes annuelles − charges variables) ÷ CA = (${Math.round(revenue)} − ${Math.round(fixedMonthly * 12)} − ${Math.round(variableAnnual)}) ÷ ${Math.round(revenue)}`,
        href: bId ? `/budget/${bId}` : undefined,
        hrefLabel: "Ouvrir le budget",
        contributors: [
          { label: "CA annuel", value: Math.round(revenue), href: categoryHref(bId, "revenue"), hrefLabel: "Voir les revenus" },
          { label: "Charges fixes (annuelles)", value: Math.round(fixedMonthly * 12), href: categoryHref(bId, "fixed_charges"), hrefLabel: "Voir les charges fixes" },
          { label: "Charges variables (annuelles)", value: Math.round(variableAnnual), href: categoryHref(bId, "variable_charges"), hrefLabel: "Voir les charges variables" },
        ],
      };
    }
  }

  return { patch, sources };
}

// -----------------------------------------------------------------------
// Text-based inference (BP / BM sections)
// -----------------------------------------------------------------------

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/[€$£¥\s]/g, "");
  let mult = 1;
  if (/[km]$/.test(s)) {
    mult = s.endsWith("m") ? 1_000_000 : 1_000;
    s = s.slice(0, -1);
  }
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

function snippetAround(text: string, index: number, length: number, pad = 40): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

function matchWithSnippet(
  text: string,
  re: RegExp,
): { raw: string; snippet: string } | null {
  const m = re.exec(text);
  if (!m) return null;
  return {
    raw: m[1] ?? m[0],
    snippet: snippetAround(text, m.index, m[0].length),
  };
}

const NUM = "([0-9]+(?:[.,\\s][0-9]+)*\\s*[km]?)";

export function kpisFromText(text: string): KpiResult {
  const patch: Partial<BusinessAssumptions> = {};
  const sources: KpiSources = {};
  if (!text || typeof text !== "string") return { patch, sources };
  const t = text.replace(/\s+/g, " ");

  const cac = matchWithSnippet(
    t,
    new RegExp(`\\bcac\\b[^0-9]{0,40}${NUM}\\s*(?:€|eur|\\$|usd)?`, "i"),
  );
  if (cac) {
    const n = parseNumber(cac.raw);
    if (n !== null && n > 0 && n < 1_000_000) {
      patch.avg_cac = Math.round(n);
      sources.avg_cac = {
        origin: "text",
        formula: "Extrait de la section générée",
        contributors: [{ label: "Extrait", snippet: cac.snippet }],
      };
    }
  }

  const ltv = matchWithSnippet(
    t,
    new RegExp(`\\bltv\\b[^0-9]{0,40}${NUM}\\s*(?:€|eur|\\$|usd)?`, "i"),
  );
  if (ltv) {
    const n = parseNumber(ltv.raw);
    if (n !== null && n > 0 && n < 10_000_000) {
      patch.avg_ltv = Math.round(n);
      sources.avg_ltv = {
        origin: "text",
        formula: "Extrait de la section générée",
        contributors: [{ label: "Extrait", snippet: ltv.snippet }],
      };
    }
  }

  const gm = matchWithSnippet(
    t,
    /marge\s+brute[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]+)?)\s*%/i,
  );
  if (gm) {
    const n = parseNumber(gm.raw);
    if (n !== null && n >= 0 && n <= 100) {
      patch.gross_margin_pct = n;
      sources.gross_margin_pct = {
        origin: "text",
        formula: "Extrait de la section générée",
        contributors: [{ label: "Extrait", snippet: gm.snippet }],
      };
    }
  }

  const em = matchWithSnippet(
    t,
    /(?:marge\s+ebitda|ebitda\s+margin)[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]+)?)\s*%/i,
  );
  if (em) {
    const n = parseNumber(em.raw);
    if (n !== null && n >= -100 && n <= 100) {
      patch.ebitda_margin_pct = n;
      sources.ebitda_margin_pct = {
        origin: "text",
        formula: "Extrait de la section générée",
        contributors: [{ label: "Extrait", snippet: em.snippet }],
      };
    }
  }

  return { patch, sources };
}

// -----------------------------------------------------------------------
// Persist to project (active scenario + business_assumptions).
// Sources are stored under `__kpi_sources` inside the active scenario entry.
// -----------------------------------------------------------------------

export async function syncKpisToProject(
  projectId: string | null | undefined,
  patch: Partial<BusinessAssumptions>,
  sources: KpiSources = {},
): Promise<boolean> {
  if (!projectId) return false;
  const clean: Partial<BusinessAssumptions> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    (clean as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(clean).length === 0 && Object.keys(sources).length === 0) return false;

  const { data, error } = await supabase
    .from("projects")
    .select("business_assumptions, assumption_scenarios, active_scenario")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const active: string = row.active_scenario || "base";
  const scenarios: Record<string, Record<string, unknown>> =
    row.assumption_scenarios || {};
  const current: BusinessAssumptions = row.business_assumptions || {};

  const prevScenario = (scenarios[active] || {}) as Record<string, unknown>;
  const prevSources = (prevScenario.__kpi_sources || {}) as KpiSources;
  const locks = (prevScenario.__kpi_locks || {}) as KpiLocks;

  // Drop any patch entry (and its source) whose key is locked in the active
  // scenario — respect the user's manual override.
  const filteredClean: Partial<BusinessAssumptions> = {};
  for (const [k, v] of Object.entries(clean)) {
    if (locks[k as keyof BusinessAssumptions]) continue;
    (filteredClean as Record<string, unknown>)[k] = v;
  }
  const filteredSources: KpiSources = {};
  for (const [k, v] of Object.entries(sources)) {
    if (locks[k as keyof BusinessAssumptions]) continue;
    (filteredSources as Record<string, unknown>)[k] = v;
  }
  if (
    Object.keys(filteredClean).length === 0 &&
    Object.keys(filteredSources).length === 0
  )
    return false;

  const nextSources: KpiSources = { ...prevSources, ...filteredSources };

  const nextScenario = {
    ...prevScenario,
    ...filteredClean,
    __kpi_sources: nextSources,
  };
  const nextScenarios = { ...scenarios, [active]: nextScenario };
  const nextAssumptions = { ...current, ...filteredClean };

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
  const { patch, sources } = kpisFromBudgetLines(lines || [], horizonMonths);
  await syncKpisToProject(projectId, patch, sources);
}

export async function syncKpisFromTexts(
  projectId: string | null | undefined,
  texts: (string | undefined | null)[],
): Promise<void> {
  const patch: Partial<BusinessAssumptions> = {};
  const sources: KpiSources = {};
  for (const t of texts) {
    if (!t) continue;
    const r = kpisFromText(String(t));
    Object.assign(patch, r.patch);
    Object.assign(sources, r.sources);
  }
  await syncKpisToProject(projectId, patch, sources);
}

// -----------------------------------------------------------------------
// Persist a KPI lock toggle for a given scenario.
// -----------------------------------------------------------------------

export async function setKpiLock(
  projectId: string | null | undefined,
  scenarioId: string,
  key: keyof BusinessAssumptions,
  locked: boolean,
): Promise<boolean> {
  if (!projectId || !scenarioId) return false;
  const { data, error } = await supabase
    .from("projects")
    .select("assumption_scenarios")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scenarios: Record<string, Record<string, unknown>> = ((data as any)
    .assumption_scenarios || {}) as Record<string, Record<string, unknown>>;
  const scen = { ...(scenarios[scenarioId] || {}) };
  const locks: KpiLocks = { ...((scen.__kpi_locks as KpiLocks) || {}) };
  if (locked) locks[key] = true;
  else delete locks[key];
  scen.__kpi_locks = locks;
  const next = { ...scenarios, [scenarioId]: scen };
  const { error: upErr } = await supabase
    .from("projects")
    .update({ assumption_scenarios: next as never })
    .eq("id", projectId);
  return !upErr;
}
