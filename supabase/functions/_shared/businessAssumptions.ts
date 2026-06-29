// Shared helpers for fetching & formatting per-project Business Assumptions
// (sector, geography, pricing, costs, growth rate, market share target...).
// Imported by every generate-* edge function so the AI prompts are consistent.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type BusinessAssumptions = {
  sector?: string;
  geography?: string;
  currency?: string;
  pricing?: string;
  costs?: string;
  growth_rate_pct?: number | null;
  market_share_target_pct?: number | null;
  target_market_size?: string;
  notes?: string;
};

export async function fetchAssumptions(
  authHeader: string | null,
  projectId?: string | null,
): Promise<BusinessAssumptions | null> {
  if (!authHeader || !projectId) return null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data } = await supabase
      .from("projects")
      .select("business_assumptions")
      .eq("id", projectId)
      .maybeSingle();
    const raw = (data as any)?.business_assumptions;
    if (raw && typeof raw === "object") return raw as BusinessAssumptions;
    return null;
  } catch (e) {
    console.error("fetchAssumptions error:", e);
    return null;
  }
}

export function mergeAssumptions(
  fromBody?: BusinessAssumptions | null,
  fromDb?: BusinessAssumptions | null,
): BusinessAssumptions | null {
  if (!fromBody && !fromDb) return null;
  return { ...(fromDb || {}), ...(fromBody || {}) };
}

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  return `- **${label}** : ${value}`;
}

export function formatAssumptionsBlock(a?: BusinessAssumptions | null): string {
  if (!a) return "";
  const lines = [
    line("Secteur d'activité", a.sector),
    line("Géographie / marché cible", a.geography),
    line("Devise", a.currency),
    line("Taille de marché visée (TAM/SAM/SOM)", a.target_market_size),
    line("Stratégie de pricing", a.pricing),
    line("Structure de coûts attendue", a.costs),
    typeof a.growth_rate_pct === "number"
      ? `- **Taux de croissance annuel cible** : ${a.growth_rate_pct}%`
      : null,
    typeof a.market_share_target_pct === "number"
      ? `- **Part de marché cible** : ${a.market_share_target_pct}%`
      : null,
    line("Notes / contraintes additionnelles", a.notes),
  ].filter(Boolean);

  if (!lines.length) return "";
  return `\n\n=== PARAMÈTRES BUSINESS (saisis par l'utilisateur) ===\n${lines.join("\n")}\n=== FIN PARAMÈTRES ===\n\nIMPORTANT : Tu DOIS utiliser ces paramètres comme hypothèses centrales (secteur, géographie, pricing, coûts, taux de croissance, part de marché). Toute estimation chiffrée doit être cohérente avec eux. Si une hypothèse est manquante, faire une hypothèse explicite et la signaler.`;
}

// --- Validation (guardrails) ----------------------------------------------
// Mirrors src/lib/validateAssumptions.ts. Errors must block generation.

export type AssumptionsValidation = {
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  ok: boolean;
};

const MAX_LEN: Record<string, number> = {
  sector: 100,
  geography: 100,
  currency: 8,
  pricing: 800,
  costs: 800,
  target_market_size: 250,
  notes: 1000,
};
const CURRENCY_RE = /^[A-Za-z]{3,4}$|^[€$£¥]$/;

export function validateAssumptions(
  a?: BusinessAssumptions | null,
): AssumptionsValidation {
  const errors: { field: string; message: string }[] = [];
  const warnings: { field: string; message: string }[] = [];
  if (!a) return { errors, warnings, ok: true };

  for (const k of Object.keys(MAX_LEN)) {
    const v = (a as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim().length > MAX_LEN[k]) {
      errors.push({ field: k, message: `${k}: max ${MAX_LEN[k]} caractères.` });
    }
  }

  const cur = typeof a.currency === "string" ? a.currency.trim() : "";
  if (cur && !CURRENCY_RE.test(cur)) {
    errors.push({
      field: "currency",
      message:
        "Devise invalide (code ISO type EUR/USD ou symbole €/$/£ attendu).",
    });
  }

  if (a.growth_rate_pct !== null && a.growth_rate_pct !== undefined) {
    const g = Number(a.growth_rate_pct);
    if (!Number.isFinite(g)) {
      errors.push({ field: "growth_rate_pct", message: "Doit être un nombre." });
    } else if (g < -90 || g > 1000) {
      errors.push({
        field: "growth_rate_pct",
        message: "Plage attendue : -90 % à +1000 %.",
      });
    }
  }

  if (
    a.market_share_target_pct !== null &&
    a.market_share_target_pct !== undefined
  ) {
    const s = Number(a.market_share_target_pct);
    if (!Number.isFinite(s)) {
      errors.push({
        field: "market_share_target_pct",
        message: "Doit être un nombre.",
      });
    } else if (s < 0 || s > 100) {
      errors.push({
        field: "market_share_target_pct",
        message: "Doit être entre 0 et 100 %.",
      });
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

export function validationErrorResponse(
  validation: AssumptionsValidation,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "invalid_assumptions",
      message: "Hypothèses business invalides — corrigez avant de générer.",
      details: validation.errors,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
