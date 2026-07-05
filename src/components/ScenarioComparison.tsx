import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import {
  BarChart3,
  Info,
  Loader2,
  Lock,
  LockOpen,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BusinessAssumptions,
  EMPTY_ASSUMPTIONS,
} from "@/lib/businessAssumptions";
import {
  LOCKABLE_KPI_KEYS,
  setKpiLock,
  type KpiLocks,
  type KpiSource,
  type KpiSources,
} from "@/lib/syncKpis";

type ScenarioMap = Record<
  string,
  BusinessAssumptions & {
    label?: string;
    __kpi_sources?: KpiSources;
    __kpi_locks?: KpiLocks;
  }
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
  const navigate = useNavigate();
  const goTo = (href: string) => {
    setOpen(false);
    // slight delay to let the dialog close before navigating
    setTimeout(() => navigate(href), 60);
  };
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
        locks: (v.__kpi_locks || {}) as KpiLocks,
      })),
    [scenarios],
  );

  const toggleLock = async (
    scenarioId: string,
    key: keyof BusinessAssumptions,
  ) => {
    const scen = scenarios[scenarioId];
    if (!scen) return;
    const currentLocks = (scen.__kpi_locks || {}) as KpiLocks;
    const nextLocked = !currentLocks[key];
    // optimistic update
    setScenarios((prev) => {
      const cur = prev[scenarioId] || ({} as ScenarioMap[string]);
      const locks = { ...((cur.__kpi_locks || {}) as KpiLocks) };
      if (nextLocked) locks[key] = true;
      else delete locks[key];
      return { ...prev, [scenarioId]: { ...cur, __kpi_locks: locks } };
    });
    const ok = await setKpiLock(projectId, scenarioId, key, nextLocked);
    if (!ok) {
      toast.error("Impossible de mettre à jour le verrou");
      // revert
      setScenarios((prev) => {
        const cur = prev[scenarioId] || ({} as ScenarioMap[string]);
        const locks = { ...((cur.__kpi_locks || {}) as KpiLocks) };
        if (nextLocked) delete locks[key];
        else locks[key] = true;
        return { ...prev, [scenarioId]: { ...cur, __kpi_locks: locks } };
      });
    } else {
      toast.success(
        nextLocked
          ? "KPI verrouillé — vos valeurs seront préservées"
          : "KPI déverrouillé — l'auto-sync est réactivé",
      );
    }
  };


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
                      <LockToggle
                        locked={!!c.locks.growth_rate_pct}
                        onToggle={() => toggleLock(c.id, "growth_rate_pct")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="Part de marché cible">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.market_share_target_pct)}
                      {trendIcon(c.a.market_share_target_pct ?? null, shareArr)}
                      <LockToggle
                        locked={!!c.locks.market_share_target_pct}
                        onToggle={() => toggleLock(c.id, "market_share_target_pct")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="CA annuel attendu">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.expected_annual_revenue, currency)}
                      {trendIcon(c.a.expected_annual_revenue ?? null, revArr)}
                      <SourceInfo source={c.sources.expected_annual_revenue} currency={currency} />
                      <LockToggle
                        locked={!!c.locks.expected_annual_revenue}
                        onToggle={() => toggleLock(c.id, "expected_annual_revenue")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="CAC moyen">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.avg_cac, currency)}
                      {trendIcon(c.a.avg_cac ?? null, cacArr, true)}
                      <SourceInfo source={c.sources.avg_cac} currency={currency} />
                      <LockToggle
                        locked={!!c.locks.avg_cac}
                        onToggle={() => toggleLock(c.id, "avg_cac")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="LTV moyen">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.avg_ltv, currency)}
                      {trendIcon(c.a.avg_ltv ?? null, ltvArr)}
                      <SourceInfo source={c.sources.avg_ltv} currency={currency} />
                      <LockToggle
                        locked={!!c.locks.avg_ltv}
                        onToggle={() => toggleLock(c.id, "avg_ltv")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="Ratio LTV / CAC">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtNum(c.derived.ltvCac, 2)}
                      {trendIcon(c.derived.ltvCac, ltvCacArr)}
                      <SourceInfo
                        source={derivedSource("LTV ÷ CAC", [
                          { label: "LTV", source: c.sources.avg_ltv, value: c.a.avg_ltv ?? null },
                          { label: "CAC", source: c.sources.avg_cac, value: c.a.avg_cac ?? null },
                        ])}
                        currency={currency}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="Marge brute">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.gross_margin_pct)}
                      {trendIcon(c.a.gross_margin_pct ?? null, gmArr)}
                      <SourceInfo source={c.sources.gross_margin_pct} currency={currency} />
                      <LockToggle
                        locked={!!c.locks.gross_margin_pct}
                        onToggle={() => toggleLock(c.id, "gross_margin_pct")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="Marge EBITDA">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtPct(c.a.ebitda_margin_pct)}
                      {trendIcon(c.a.ebitda_margin_pct ?? null, ebitdaMarginArr)}
                      <SourceInfo source={c.sources.ebitda_margin_pct} currency={currency} />
                      <LockToggle
                        locked={!!c.locks.ebitda_margin_pct}
                        onToggle={() => toggleLock(c.id, "ebitda_margin_pct")}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="EBITDA annuel estimé">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.derived.ebitdaAnnual, currency)}
                      {trendIcon(c.derived.ebitdaAnnual, ebitdaArr)}
                      <SourceInfo
                        source={derivedSource("CA annuel × marge EBITDA", [
                          {
                            label: "CA annuel",
                            source: c.sources.expected_annual_revenue,
                            value: c.a.expected_annual_revenue ?? null,
                          },
                          {
                            label: "Marge EBITDA (%)",
                            source: c.sources.ebitda_margin_pct,
                            value: c.a.ebitda_margin_pct ?? null,
                          },
                        ])}
                        currency={currency}
                      />
                    </TableCell>
                  ))}
                </Row>
                <Row label="Coûts fixes / mois">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.a.fixed_costs_monthly, currency)}
                      {trendIcon(c.a.fixed_costs_monthly ?? null, fcArr, true)}
                      <SourceInfo source={c.sources.fixed_costs_monthly} currency={currency} />
                      <LockToggle
                        locked={!!c.locks.fixed_costs_monthly}
                        onToggle={() => toggleLock(c.id, "fixed_costs_monthly")}
                      />
                    </TableCell>
                  ))}
                </Row>

                <Row label="Point mort (CA mensuel)">
                  {cols.map((c) => (
                    <TableCell key={c.id}>
                      {fmtMoney(c.derived.breakevenRevenueMonthly, currency)}
                      {trendIcon(c.derived.breakevenRevenueMonthly, beArr, true)}
                      <SourceInfo
                        source={derivedSource("Coûts fixes mensuels ÷ marge brute", [
                          {
                            label: "Coûts fixes / mois",
                            source: c.sources.fixed_costs_monthly,
                            value: c.a.fixed_costs_monthly ?? null,
                          },
                          {
                            label: "Marge brute (%)",
                            source: c.sources.gross_margin_pct,
                            value: c.a.gross_margin_pct ?? null,
                          },
                        ])}
                        currency={currency}
                      />
                    </TableCell>
                  ))}
                </Row>

              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground mt-3">
              Calculs : LTV/CAC = LTV ÷ CAC · EBITDA annuel = CA × marge EBITDA
              · Point mort mensuel = coûts fixes ÷ marge brute. Cliquez sur
              l'icône <Lock className="w-3 h-3 inline" /> pour verrouiller un
              KPI : sa valeur (et son origine) seront préservées lors des
              prochaines générations.

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

function LockToggle({
  locked,
  onToggle,
}: {
  locked: boolean;
  onToggle: () => void;
}) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={locked ? "Déverrouiller ce KPI" : "Verrouiller ce KPI"}
      title={
        locked
          ? "KPI verrouillé — la valeur ne sera pas écrasée par les générations"
          : "Verrouiller pour préserver cette valeur lors des générations"
      }
      className={`inline-flex ml-1 align-middle transition-colors ${
        locked
          ? "text-amber-500 hover:text-amber-600"
          : "text-muted-foreground/60 hover:text-foreground"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function SourceInfo({
  source,
  currency = "EUR",
}: {
  source?: KpiSource | null;
  currency?: string;
}) {
  if (!source) return null;
  const originLabel =
    source.origin === "budget"
      ? "Calculé depuis le budget"
      : source.origin === "text"
        ? "Extrait du texte généré"
        : "Saisie manuelle";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Voir le détail du calcul"
          className="inline-flex ml-1 align-middle text-muted-foreground hover:text-foreground"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 text-xs space-y-2">
        <div className="font-medium text-sm">{originLabel}</div>
        {source.formula && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Formule : </span>
            {source.formula}
          </div>
        )}
        {source.contributors && source.contributors.length > 0 && (
          <div>
            <div className="font-medium text-foreground mb-1">
              {source.origin === "budget" ? "Lignes sources" : "Extraits"}
            </div>
            <ul className="space-y-1 max-h-52 overflow-y-auto">
              {source.contributors.map((c, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {c.snippet ? (
                      <em className="not-italic">« {c.snippet} »</em>
                    ) : (
                      c.label
                    )}
                  </span>
                  {typeof c.value === "number" && (
                    <span className="tabular-nums font-medium shrink-0">
                      {c.value.toLocaleString("fr-FR")}{" "}
                      {currency === "USD"
                        ? "$"
                        : currency === "GBP"
                          ? "£"
                          : currency === "EUR"
                            ? "€"
                            : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Build a synthetic source for a derived KPI from its underlying components.
function derivedSource(
  formula: string,
  parts: Array<{ label: string; source?: KpiSource | null; value?: number | null }>,
): KpiSource | null {
  const contributors: KpiContributorLite[] = [];
  for (const p of parts) {
    if (p.value !== null && p.value !== undefined && Number.isFinite(p.value)) {
      contributors.push({ label: p.label, value: Math.round(p.value) });
    }
    const src = p.source;
    if (src?.contributors) {
      for (const c of src.contributors) {
        contributors.push({
          label: `${p.label} · ${c.label}`,
          value: c.value,
          snippet: c.snippet,
        });
      }
    }
  }
  if (contributors.length === 0) return null;
  return { origin: "budget", formula, contributors };
}

type KpiContributorLite = {
  label: string;
  value?: number | string;
  snippet?: string;
};
