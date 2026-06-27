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
