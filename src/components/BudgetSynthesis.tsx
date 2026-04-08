import { useMemo } from "react";
import { BudgetLineRow } from "@/hooks/useBudgets";
import { TrendingUp, TrendingDown, Target, Wallet } from "lucide-react";

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
function getMonthLabel(i: number) {
  return MONTH_LABELS[i % 12] + (i >= 12 ? ` A${Math.floor(i / 12) + 1}` : "");
}

interface Props {
  lines: BudgetLineRow[];
  horizonMonths: number;
}

export default function BudgetSynthesis({ lines, horizonMonths }: Props) {
  const visibleMonths = Math.min(horizonMonths, 12);

  const data = useMemo(() => {
    const monthly = Array.from({ length: visibleMonths }, (_, m) => {
      const revenue = lines
        .filter(l => l.category === "revenue" && !l.is_total)
        .reduce((s, l) => s + ((l.monthly_values as number[])[m] || 0), 0);
      const fixed = lines
        .filter(l => l.category === "fixed_charges" && !l.is_total)
        .reduce((s, l) => s + ((l.monthly_values as number[])[m] || 0), 0);
      const variable = lines
        .filter(l => l.category === "variable_charges" && !l.is_total)
        .reduce((s, l) => s + ((l.monthly_values as number[])[m] || 0), 0);
      const treasury = lines
        .filter(l => l.category === "treasury" && !l.is_total)
        .reduce((s, l) => s + ((l.monthly_values as number[])[m] || 0), 0);
      const investments = lines
        .filter(l => l.category === "investments" && !l.is_total)
        .reduce((s, l) => s + ((l.monthly_values as number[])[m] || 0), 0);

      const totalCharges = Math.abs(fixed) + Math.abs(variable);
      const netResult = revenue - totalCharges;
      return { revenue, fixed, variable, totalCharges, netResult, treasury, investments };
    });

    const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
    const totalFixed = monthly.reduce((s, m) => s + Math.abs(m.fixed), 0);
    const totalVariable = monthly.reduce((s, m) => s + Math.abs(m.variable), 0);
    const totalCharges = totalFixed + totalVariable;
    const totalNet = totalRevenue - totalCharges;
    const totalTreasury = monthly.reduce((s, m) => s + m.treasury, 0);
    const totalInvestments = monthly.reduce((s, m) => s + Math.abs(m.investments), 0);

    // Seuil de rentabilité (break-even) = Fixed Costs / (1 - Variable/Revenue)
    const variableRatio = totalRevenue > 0 ? totalVariable / totalRevenue : 0;
    const breakEven = variableRatio < 1 ? totalFixed / (1 - variableRatio) : null;

    // BFR simplifié = (Trésorerie entrante - Trésorerie sortante) approximé par le solde de trésorerie
    // En pratique : BFR = Créances clients + Stocks - Dettes fournisseurs
    // Ici on utilise les données de trésorerie comme proxy
    const bfr = totalTreasury;

    // Marge nette
    const netMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

    return { monthly, totalRevenue, totalFixed, totalVariable, totalCharges, totalNet, breakEven, bfr, netMargin, totalTreasury, totalInvestments };
  }, [lines, visibleMonths]);

  const fmt = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  const colorClass = (v: number) => v < 0 ? "text-destructive" : "text-emerald-600";

  const rows = [
    { label: "Chiffre d'affaires", values: data.monthly.map(m => m.revenue), total: data.totalRevenue, bold: true },
    { label: "Charges fixes", values: data.monthly.map(m => -Math.abs(m.fixed)), total: -data.totalFixed },
    { label: "Charges variables", values: data.monthly.map(m => -Math.abs(m.variable)), total: -data.totalVariable },
    { label: "Total charges", values: data.monthly.map(m => -m.totalCharges), total: -data.totalCharges, bold: true, separator: true },
    { label: "Résultat net", values: data.monthly.map(m => m.netResult), total: data.totalNet, bold: true, highlight: true },
    { label: "Trésorerie", values: data.monthly.map(m => m.treasury), total: data.totalTreasury },
    { label: "Investissements", values: data.monthly.map(m => -Math.abs(m.investments)), total: -data.totalInvestments },
  ];

  // Cumulative net for break-even visualization
  let cumNet = 0;
  const breakEvenMonth = data.monthly.findIndex(m => {
    cumNet += m.netResult;
    return cumNet >= 0 && m.netResult > 0;
  });

  return (
    <div className="glass-card rounded-xl overflow-hidden mt-6">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Tableau de synthèse
        </h3>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-muted-foreground">Résultat net</span>
          </div>
          <p className={`text-xl font-bold ${colorClass(data.totalNet)}`}>{fmt(data.totalNet)} €</p>
          <p className="text-xs text-muted-foreground">Marge : {data.netMargin.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Seuil de rentabilité</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {data.breakEven !== null ? `${fmt(data.breakEven)} €` : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground">
            {breakEvenMonth >= 0 ? `Atteint au mois ${breakEvenMonth + 1}` : "Non atteint"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">BFR estimé</span>
          </div>
          <p className={`text-xl font-bold ${colorClass(data.bfr)}`}>{fmt(data.bfr)} €</p>
          <p className="text-xs text-muted-foreground">Besoin en fonds de roulement</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground">Investissements</span>
          </div>
          <p className="text-xl font-bold text-foreground">{fmt(data.totalInvestments)} €</p>
          <p className="text-xs text-muted-foreground">Total sur la période</p>
        </div>
      </div>

      {/* Synthesis Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t bg-muted/30">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground min-w-[160px] sticky left-0 bg-muted/30">
                Poste
              </th>
              {Array.from({ length: data.monthly.length }, (_, i) => (
                <th key={i} className="text-right px-2 py-2 font-medium text-muted-foreground min-w-[75px]">
                  {getMonthLabel(i)}
                </th>
              ))}
              <th className="text-right px-4 py-2 font-bold text-muted-foreground min-w-[100px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={`border-t ${row.highlight ? "bg-primary/5" : ""} ${row.separator ? "border-t-2 border-border" : ""}`}
              >
                <td className={`px-4 py-2 sticky left-0 bg-background ${row.bold ? "font-bold" : ""}`}>
                  {row.label}
                </td>
                {row.values.map((v, m) => (
                  <td key={m} className={`px-2 py-2 text-right text-xs ${row.bold ? "font-bold" : ""} ${colorClass(v)}`}>
                    {fmt(v)}
                  </td>
                ))}
                <td className={`px-4 py-2 text-right font-bold ${colorClass(row.total)}`}>
                  {fmt(row.total)} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
