// Shared type and helpers for the per-project "Business Assumptions"
// (sector, geography, pricing, costs, growth rate, market share, etc.)
// Used by the UI panel and to feed the AI generation Edge Functions.

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

export const EMPTY_ASSUMPTIONS: BusinessAssumptions = {
  sector: "",
  geography: "",
  currency: "EUR",
  pricing: "",
  costs: "",
  growth_rate_pct: null,
  market_share_target_pct: null,
  target_market_size: "",
  notes: "",
};

export function hasAnyAssumption(a?: BusinessAssumptions | null): boolean {
  if (!a) return false;
  return Boolean(
    (a.sector && a.sector.trim()) ||
      (a.geography && a.geography.trim()) ||
      (a.pricing && a.pricing.trim()) ||
      (a.costs && a.costs.trim()) ||
      (typeof a.growth_rate_pct === "number") ||
      (typeof a.market_share_target_pct === "number") ||
      (a.target_market_size && a.target_market_size.trim()) ||
      (a.notes && a.notes.trim())
  );
}
