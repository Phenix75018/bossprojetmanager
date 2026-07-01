// Validation rules and guardrails for the per-project Business Assumptions.
// Used by the BusinessAssumptionsPanel (live feedback) and as a pre-flight
// check before invoking any generate-* Edge Function.

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BusinessAssumptions,
  EMPTY_ASSUMPTIONS,
  hasAnyAssumption,
} from "@/lib/businessAssumptions";

export type ValidationIssue = {
  field: keyof BusinessAssumptions | "global";
  message: string;
  suggestion?: string;
  acceptableRange?: string;
  suggestedValue?: string | number;
};

export type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  ok: boolean;
};

const MAX = {
  sector: 100,
  geography: 100,
  currency: 8,
  pricing: 800,
  costs: 800,
  target_market_size: 250,
  notes: 1000,
} as const;

const CURRENCY_RE = /^[A-Za-z]{3,4}$|^[€$£¥]$/;
const NUMBER_HINT_RE = /\d/;

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validateAssumptions(
  a?: BusinessAssumptions | null,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!a || !hasAnyAssumption(a)) {
    // Nothing filled in: not blocking, but flag a warning so user knows
    // the AI will rely on generic defaults.
    warnings.push({
      field: "global",
      message:
        "Aucun paramètre business renseigné — la génération utilisera des hypothèses génériques.",
    });
    return { errors, warnings, ok: true };
  }

  // Strings: length caps
  (Object.keys(MAX) as (keyof typeof MAX)[]).forEach((k) => {
    const v = txt((a as Record<string, unknown>)[k]);
    if (v.length > MAX[k]) {
      errors.push({
        field: k as keyof BusinessAssumptions,
        message: `${k} : ${v.length} caractères, max ${MAX[k]}.`,
      });
    }
  });

  // Currency format
  const cur = txt(a.currency);
  if (cur && !CURRENCY_RE.test(cur)) {
    errors.push({
      field: "currency",
      message:
        "Devise invalide : utilisez un code ISO (ex: EUR, USD, GBP) ou un symbole (€, $, £).",
    });
  }

  // Growth rate
  if (a.growth_rate_pct !== null && a.growth_rate_pct !== undefined) {
    const g = Number(a.growth_rate_pct);
    if (!Number.isFinite(g)) {
      errors.push({
        field: "growth_rate_pct",
        message: "Taux de croissance : valeur numérique attendue.",
      });
    } else if (g < -90 || g > 1000) {
      errors.push({
        field: "growth_rate_pct",
        message: "Taux de croissance hors plage réaliste (-90 % à +1000 %).",
      });
    } else if (g > 300) {
      warnings.push({
        field: "growth_rate_pct",
        message: `Croissance ${g} %/an très agressive — vérifiez la cohérence avec votre TAM/SAM.`,
      });
    } else if (g < 0) {
      warnings.push({
        field: "growth_rate_pct",
        message: "Croissance négative : assurez-vous que c'est volontaire.",
      });
    }
  }

  // Market share
  if (
    a.market_share_target_pct !== null &&
    a.market_share_target_pct !== undefined
  ) {
    const s = Number(a.market_share_target_pct);
    if (!Number.isFinite(s)) {
      errors.push({
        field: "market_share_target_pct",
        message: "Part de marché : valeur numérique attendue.",
      });
    } else if (s < 0 || s > 100) {
      errors.push({
        field: "market_share_target_pct",
        message: "Part de marché doit être comprise entre 0 et 100 %.",
      });
    } else if (s > 30) {
      warnings.push({
        field: "market_share_target_pct",
        message: `Part de marché cible ${s} % très élevée — justifiez la stratégie de conquête.`,
      });
    }
  }

  // Pricing should contain at least one number when filled
  const pricing = txt(a.pricing);
  if (pricing && !NUMBER_HINT_RE.test(pricing)) {
    warnings.push({
      field: "pricing",
      message:
        "Pricing renseigné sans valeur chiffrée — précisez un montant pour des estimations fiables.",
    });
  }

  // Costs should contain at least one number when filled
  const costs = txt(a.costs);
  if (costs && !NUMBER_HINT_RE.test(costs)) {
    warnings.push({
      field: "costs",
      message:
        "Structure de coûts sans valeur chiffrée — précisez des montants ou % du CA.",
    });
  }

  // Cross-field coherence
  if (
    typeof a.growth_rate_pct === "number" &&
    typeof a.market_share_target_pct === "number" &&
    a.growth_rate_pct > 150 &&
    a.market_share_target_pct > 40
  ) {
    warnings.push({
      field: "global",
      message:
        "Cumul croissance > 150 %/an et part de marché > 40 % : objectifs très ambitieux, prévoir une justification solide.",
    });
  }

  return { errors, warnings, ok: errors.length === 0 };
}

/**
 * Pre-flight: load assumptions from DB and validate.
 * - Shows toast for each error and returns false.
 * - Shows a single grouped toast for warnings (non-blocking).
 */
export async function preflightAssumptions(
  projectId?: string | null,
): Promise<boolean> {
  if (!projectId) return true;
  const { data, error } = await supabase
    .from("projects")
    .select("business_assumptions")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    // Don't block generation on a read failure; just warn.
    console.warn("preflightAssumptions read failed:", error);
    return true;
  }
  const a = {
    ...EMPTY_ASSUMPTIONS,
    ...((data?.business_assumptions ?? {}) as BusinessAssumptions),
  };
  const res = validateAssumptions(a);
  if (!res.ok) {
    toast.error("Hypothèses business invalides", {
      description: res.errors.map((e) => `• ${e.message}`).join("\n"),
      duration: 8000,
    });
    return false;
  }
  if (res.warnings.length > 0) {
    toast.warning("Hypothèses business : points d'attention", {
      description: res.warnings.map((w) => `• ${w.message}`).join("\n"),
      duration: 6000,
    });
  }
  return true;
}

/**
 * Same as preflightAssumptions but for in-memory assumptions
 * (e.g. Onboarding before the project exists in DB).
 */
export function preflightAssumptionsLocal(
  a?: BusinessAssumptions | null,
): boolean {
  const res = validateAssumptions(a);
  if (!res.ok) {
    toast.error("Hypothèses business invalides", {
      description: res.errors.map((e) => `• ${e.message}`).join("\n"),
      duration: 8000,
    });
    return false;
  }
  if (res.warnings.length > 0) {
    toast.warning("Hypothèses business : points d'attention", {
      description: res.warnings.map((w) => `• ${w.message}`).join("\n"),
      duration: 6000,
    });
  }
  return true;
}
