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
      suggestion: "Essayez « EUR », « USD » ou « € ».",
      acceptableRange: "Code ISO 3-4 lettres ou symbole € $ £ ¥",
      suggestedValue: "EUR",
    });
  }

  // Growth rate
  const GROWTH_RANGE = "-90 % à +1000 % (typiquement 10–80 %/an)";
  if (a.growth_rate_pct !== null && a.growth_rate_pct !== undefined) {
    const g = Number(a.growth_rate_pct);
    if (!Number.isFinite(g)) {
      errors.push({
        field: "growth_rate_pct",
        message: "Taux de croissance : valeur numérique attendue.",
        suggestion: "Saisissez un nombre entier ou décimal (ex: 30 pour 30 %).",
        acceptableRange: GROWTH_RANGE,
        suggestedValue: 30,
      });
    } else if (g < -90 || g > 1000) {
      errors.push({
        field: "growth_rate_pct",
        message: `Taux de croissance ${g} % hors plage réaliste.`,
        suggestion:
          g > 1000
            ? "Une croissance > 1000 %/an n'est pas soutenable — ramenez à 80–150 % max en phase hyper-croissance."
            : "Une chute > 90 % implique un arrêt d'activité — revoyez à la hausse.",
        acceptableRange: GROWTH_RANGE,
        suggestedValue: g > 1000 ? 100 : -50,
      });
    } else if (g > 300) {
      warnings.push({
        field: "growth_rate_pct",
        message: `Croissance ${g} %/an très agressive — vérifiez la cohérence avec votre TAM/SAM.`,
        suggestion:
          "Les scale-ups tech tournent à 100–200 %/an sur 2-3 ans max. Envisagez 150 % ou justifiez.",
        acceptableRange: "10–200 %/an réaliste, 200–300 % exceptionnel",
        suggestedValue: 150,
      });
    } else if (g < 0) {
      warnings.push({
        field: "growth_rate_pct",
        message: "Croissance négative : assurez-vous que c'est volontaire.",
        suggestion: "Pour une phase de recentrage, indiquer -10 à -30 % est courant.",
        acceptableRange: GROWTH_RANGE,
      });
    }
  }

  // Market share
  const SHARE_RANGE = "0 à 100 % (typiquement 0,5–10 % en 3-5 ans)";
  if (
    a.market_share_target_pct !== null &&
    a.market_share_target_pct !== undefined
  ) {
    const s = Number(a.market_share_target_pct);
    if (!Number.isFinite(s)) {
      errors.push({
        field: "market_share_target_pct",
        message: "Part de marché : valeur numérique attendue.",
        suggestion: "Saisissez un pourcentage (ex: 3 pour 3 % du marché adressable).",
        acceptableRange: SHARE_RANGE,
        suggestedValue: 3,
      });
    } else if (s < 0 || s > 100) {
      errors.push({
        field: "market_share_target_pct",
        message: `Part de marché ${s} % hors plage.`,
        suggestion:
          "Une part réaliste à 3-5 ans se situe entre 0,5 % et 10 % du SAM.",
        acceptableRange: SHARE_RANGE,
        suggestedValue: 5,
      });
    } else if (s > 30) {
      warnings.push({
        field: "market_share_target_pct",
        message: `Part de marché cible ${s} % très élevée — justifiez la stratégie de conquête.`,
        suggestion:
          "Seuls les leaders monopolistiques dépassent 30 %. Envisagez 10–15 % ou segmentez votre SAM.",
        acceptableRange: SHARE_RANGE,
        suggestedValue: 10,
      });
    }
  }

  // Pricing: number presence + magnitude sanity
  const pricing = txt(a.pricing);
  const PRICING_RANGE =
    "B2C SaaS : 5–50 €/mois • B2B SaaS : 30–500 €/mois • Entreprise : 1–10 k€/mois";
  if (pricing && !NUMBER_HINT_RE.test(pricing)) {
    warnings.push({
      field: "pricing",
      message:
        "Pricing renseigné sans valeur chiffrée — précisez un montant pour des estimations fiables.",
      suggestion: "Ex: « 29 €/mois Pro, 99 €/mois Business, setup 500 € ».",
      acceptableRange: PRICING_RANGE,
    });
  } else if (pricing) {
    const nums = pricing.match(/\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(",", "."))) ?? [];
    const maxPrice = nums.length ? Math.max(...nums) : 0;
    if (maxPrice > 0 && maxPrice < 3) {
      warnings.push({
        field: "pricing",
        message: `Pricing très bas détecté (${maxPrice}) — risque de non-rentabilité.`,
        suggestion:
          "Vérifiez le CAC/LTV : sous 5 €/mois, l'acquisition payante devient rarement rentable.",
        acceptableRange: PRICING_RANGE,
        suggestedValue: 19,
      });
    } else if (maxPrice > 100000) {
      warnings.push({
        field: "pricing",
        message: `Pricing très élevé (${maxPrice}) — cycle de vente long à prévoir.`,
        suggestion: "Au-delà de 100 k€, prévoyez 6-12 mois de cycle de vente enterprise.",
        acceptableRange: PRICING_RANGE,
      });
    }
  }

  // Costs
  const costs = txt(a.costs);
  if (costs && !NUMBER_HINT_RE.test(costs)) {
    warnings.push({
      field: "costs",
      message:
        "Structure de coûts sans valeur chiffrée — précisez des montants ou % du CA.",
      suggestion:
        "Ex: « 2 ETP à 55 k€ chargés, hébergement 800 €/mois, marketing 20 % du CA ».",
      acceptableRange:
        "Masse salariale 40–60 % CA • Marketing 15–30 % CA • Infra 2–8 % CA",
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
