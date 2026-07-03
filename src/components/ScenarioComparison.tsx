import { useEffect, useMemo, useState } from "react";
import { BarChart3, Info, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  BusinessAssumptions,
  EMPTY_ASSUMPTIONS,
} from "@/lib/businessAssumptions";
import type { KpiSource, KpiSources } from "@/lib/syncKpis";

type ScenarioMap = Record<
  string,
  BusinessAssumptions & { label?: string; __kpi_sources?: KpiSources }
>;

interface Props {
  projectId: string | null | undefined;
  className?: string;
  triggerLabel?: string;
}

const DEFAULT_LABELS: Record<string, string> = {
  base: "Base",
  bull: "Bull",
  bear: "Bear",
};

// --- Formatters -----------------------------------------------------------

function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}
function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;
}
function fmtMoney(v: number | null | undefined, currency = "EUR"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const sym =
    currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${sym}`;
}
function trunc(s: string | undefined, n = 60): string {
  if (!s) return "—";
  const t = s.trim();
  if (!t) return "—";
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// --- Derived KPIs ---------------------------------------------------------

type Derived = {
  ltvCac: number | null;
  ebitdaAnnual: number | null;
  breakevenRevenueMonthly: number | null;
};

function derive(a: BusinessAssumptions): Derived {
  const cac = typeof a.avg_cac === "number" ? a.avg_cac : null;
  const ltv = typeof a.avg_ltv === "number" ? a.avg_ltv : null;
  const ltvCac = cac && ltv && cac > 0 ? ltv / cac : null;

  const rev = typeof a.expected_annual_revenue === "number" ? a.expected_annual_revenue : null;
  const ebitdaMargin =
    typeof a.ebitda_margin_pct === "number" ? a.ebitda_margin_pct : null;
  const ebitdaAnnual =
    rev !== null && ebitdaMargin !== null ? (rev * ebitdaMargin) / 100 : null;

  const gm = typeof a.gross_margin_pct === "number" ? a.gross_margin_pct : null;
  const fc = typeof a.fixed_costs_monthly === "number" ? a.fixed_costs_monthly : null;
  const breakevenRevenueMonthly =
    gm !== null && gm > 0 && fc !== null ? fc / (gm / 100) : null;

  return { ltvCac, ebitdaAnnual, breakevenRevenueMonthly };
}

// Highlight indicator relative to best/worst across scenarios (higher = better,
// except for CAC / fixed costs / breakeven which are inverted).
function trendIcon(value: number | null, all: (number | null)[], invert = false) {
  const nums = all.filter((v): v is number => v !== null && Number.isFinite(v));
  if (value === null || nums.length < 2) return null;
  const best = invert ? Math.min(...nums) : Math.max(...nums);
  const worst = invert ? Math.max(...nums) : Math.min(...nums);
  if (value === best && best !== worst)
    return <TrendingUp className="w-3.5 h-3.5 text-emerald-500 inline ml-1" />;
  if (value === worst && best !== worst)
    return <TrendingDown className="w-3.5 h-3.5 text-red-500 inline ml-1" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground inline ml-1" />;
}

// --- Component ------------------------------------------------------------

export default function ScenarioComparison({
  projectId,
  className,
  triggerLabel = "Comparer les scénarios",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioMap>({});
  const [active, setActive] = useState<string>("base");
  const [currency, setCurrency] = useState<string>("EUR");

  useEffect(() => {
    if (!open || !projectId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("business_assumptions, assumption_scenarios, active_scenario")
        .eq("id", projectId)
        .maybeSingle();
      if (cancel) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      let map: ScenarioMap = (row?.assumption_scenarios ?? {}) as ScenarioMap;
      const current = (row?.business_assumptions ?? {}) as BusinessAssumptions;
      if (!map || Object.keys(map).length === 0) {
        map = { base: { ...EMPTY_ASSUMPTIONS, ...current, label: "Base" } };
      }
      setScenarios(map);
      setActive(row?.active_scenario || "base");
      setCurrency(current.currency || "EUR");
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, projectId]);

  const cols = useMemo(
    () =>
      Object.entries(scenarios).map(([id, v]) => ({
        id,
        label: v.label || DEFAULT_LABELS[id] || id,
        a: { ...EMPTY_ASSUMPTIONS, ...v } as BusinessAssumptions,
        derived: derive(v),
        sources: (v.__kpi_sources || {}) as KpiSources,
      })),
    [scenarios],
  );

  const growthArr = cols.map((c) => c.a.growth_rate_pct ?? null);
  const shareArr = cols.map((c) => c.a.market_share_target_pct ?? null);
  const cacArr = cols.map((c) => c.a.avg_cac ?? null);
  const ltvArr = cols.map((c) => c.a.avg_ltv ?? null);
  const ltvCacArr = cols.map((c) => c.derived.ltvCac);
  const gmArr = cols.map((c) => c.a.gross_margin_pct ?? null);
  const ebitdaMarginArr = cols.map((c) => c.a.ebitda_margin_pct ?? null);
  const ebitdaArr = cols.map((c) => c.derived.ebitdaAnnual);
  const fcArr = cols.map((c) => c.a.fixed_costs_monthly ?? null);
  const beArr = cols.map((c) => c.derived.breakevenRevenueMonthly);
  const revArr = cols.map((c) => c.a.expected_annual_revenue ?? null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!projectId}
          className={className}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparaison des scénarios</DialogTitle>
          <DialogDescription>
            Vue synthétique des KPIs par scénario (pricing, coûts, croissance,
            part de marché, CAC/LTV, EBITDA, point mort). Les indicateurs
            comparent chaque scénario aux autres.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Chargement…
          </div>
        ) : cols.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucun scénario enregistré pour ce projet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">KPI</TableHead>
                  {cols.map((c) => (
                    <TableHead key={c.id}>
                      {c.label}
                      {c.id === active && (
                        <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                          ACTIF
                        </span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <Row label="Secteur">
                  {cols.map((c) => (
                    <TableCell key={c.id} className="text-xs">
                      {trunc(c.a.sector)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Géographie">
                  {cols.map((c) => (
                    <TableCell key={c.id} className="text-xs">
                      {trunc(c.a.geography)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Pricing">
                  {cols.map((c) => (
                    <TableCell key={c.id} className="text-xs">
                      {trunc(c.a.pricing, 80)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Structure de coûts">
                  {cols.map((c) => (
                    <TableCell key={c.id} className="text-xs">
                      {trunc(c.a.costs, 80)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Croissance annuelle">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.growth_rate_pct)}
                      {trendIcon(c.a.growth_rate_pct ?? null, growthArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Part de marché cible">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.market_share_target_pct)}
                      {trendIcon(c.a.market_share_target_pct ?? null, shareArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="CA annuel attendu">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.expected_annual_revenue, currency)}
                      {trendIcon(c.a.expected_annual_revenue ?? null, revArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="CAC moyen">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.avg_cac, currency)}
                      {trendIcon(c.a.avg_cac ?? null, cacArr, true)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="LTV moyen">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.avg_ltv, currency)}
                      {trendIcon(c.a.avg_ltv ?? null, ltvArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Ratio LTV / CAC">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtNum(c.derived.ltvCac, 2)}
                      {trendIcon(c.derived.ltvCac, ltvCacArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Marge brute">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.gross_margin_pct)}
                      {trendIcon(c.a.gross_margin_pct ?? null, gmArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Marge EBITDA">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.ebitda_margin_pct)}
                      {trendIcon(c.a.ebitda_margin_pct ?? null, ebitdaMarginArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="EBITDA annuel estimé">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.derived.ebitdaAnnual, currency)}
                      {trendIcon(c.derived.ebitdaAnnual, ebitdaArr)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Coûts fixes / mois">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.fixed_costs_monthly, currency)}
                      {trendIcon(c.a.fixed_costs_monthly ?? null, fcArr, true)}
                    </TableCell>
                  ))}
                </Row>
                <Row label="Point mort (CA mensuel)">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.derived.breakevenRevenueMonthly, currency)}
                      {trendIcon(c.derived.breakevenRevenueMonthly, beArr, true)}
                    </TableCell>
                  ))}
                </Row>
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground mt-3">
              Calculs : LTV/CAC = LTV ÷ CAC · EBITDA annuel = CA × marge EBITDA
              · Point mort mensuel = coûts fixes ÷ marge brute. Les KPIs
              financiers optionnels (CAC, LTV, marges, coûts fixes, CA attendu)
              se saisissent dans « Gérer les scénarios ».
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{label}</TableCell>
      {children}
    </TableRow>
  );
}
