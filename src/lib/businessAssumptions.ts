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
  // Optional financial KPIs used by the scenario comparison view.
  avg_cac?: number | null;
  avg_ltv?: number | null;
  gross_margin_pct?: number | null;
  fixed_costs_monthly?: number | null;
  ebitda_margin_pct?: number | null;
  expected_annual_revenue?: number | null;
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
  avg_cac: null,
  avg_ltv: null,
  gross_margin_pct: null,
  fixed_costs_monthly: null,
  ebitda_margin_pct: null,
  expected_annual_revenue: null,
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
