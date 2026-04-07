import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from "recharts";
import { BarChart3, PieChart as PieIcon, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BudgetLineRow } from "@/hooks/useBudgets";

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
function getMonthLabel(i: number) {
  return MONTH_LABELS[i % 12] + (i >= 12 ? ` A${Math.floor(i / 12) + 1}` : "");
}

const CAT_COLORS: Record<string, string> = {
  revenue: "hsl(152, 60%, 45%)",
  fixed_charges: "hsl(0, 65%, 55%)",
  variable_charges: "hsl(30, 75%, 50%)",
  treasury: "hsl(210, 65%, 50%)",
  investments: "hsl(270, 55%, 55%)",
};

const CAT_LABELS: Record<string, string> = {
  revenue: "Revenus",
  fixed_charges: "Charges fixes",
  variable_charges: "Charges variables",
  treasury: "Trésorerie",
  investments: "Investissements",
};

type ChartView = "bar" | "line" | "pie";

interface Props {
  lines: BudgetLineRow[];
  horizonMonths: number;
}

export default function BudgetCharts({ lines, horizonMonths }: Props) {
  const [view, setView] = useState<ChartView>("bar");
  const visibleMonths = Math.min(horizonMonths, 12);

  // Monthly totals per category (excluding is_total lines)
  const monthlyData = useMemo(() => {
    const result: { name: string; revenue: number; fixed_charges: number; variable_charges: number; treasury: number; investments: number }[] = [];
    for (let m = 0; m < visibleMonths; m++) {
      const row: any = { name: getMonthLabel(m) };
      for (const cat of Object.keys(CAT_LABELS)) {
        const catLines = lines.filter(l => l.category === cat && !l.is_total);
        row[cat] = catLines.reduce((sum, l) => {
          const vals = (l.monthly_values as number[]) || [];
          return sum + (vals[m] || 0);
        }, 0);
      }
      result.push(row);
    }
    return result;
  }, [lines, visibleMonths]);

  // Pie data: total per category
  const pieData = useMemo(() => {
    return Object.keys(CAT_LABELS).map(cat => {
      const catLines = lines.filter(l => l.category === cat && !l.is_total);
      const total = catLines.reduce((sum, l) => {
        const vals = (l.monthly_values as number[]) || [];
        return sum + vals.reduce((a, b) => a + Math.abs(b), 0);
      }, 0);
      return { name: CAT_LABELS[cat], value: total, color: CAT_COLORS[cat] };
    }).filter(d => d.value > 0);
  }, [lines]);

  // Cumulative treasury line
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map(d => {
      const net = d.revenue + d.fixed_charges + d.variable_charges;
      cumulative += net;
      return { name: d.name, "Résultat mensuel": net, "Résultat cumulé": cumulative };
    });
  }, [monthlyData]);

  if (lines.filter(l => !l.is_total).length === 0) return null;

  const tooltipStyle = {
    borderRadius: "8px",
    fontSize: "12px",
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground">📊 Visualisation</h3>
        <div className="flex gap-1">
          <Button variant={view === "bar" ? "default" : "ghost"} size="sm" onClick={() => setView("bar")} className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Barres
          </Button>
          <Button variant={view === "line" ? "default" : "ghost"} size="sm" onClick={() => setView("line")} className="gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5" /> Lignes
          </Button>
          <Button variant={view === "pie" ? "default" : "ghost"} size="sm" onClick={() => setView("pie")} className="gap-1.5 text-xs">
            <PieIcon className="w-3.5 h-3.5" /> Camembert
          </Button>
        </div>
      </div>

      {view === "bar" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue vs Charges */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Revenus vs Charges par mois</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="revenue" name="Revenus" fill={CAT_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fixed_charges" name="Charges fixes" fill={CAT_COLORS.fixed_charges} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="variable_charges" name="Charges var." fill={CAT_COLORS.variable_charges} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Résultat cumulé */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Résultat net cumulé</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area type="monotone" dataKey="Résultat cumulé" stroke="hsl(210, 65%, 50%)" fill="hsl(210, 65%, 50%)" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="Résultat mensuel" stroke="hsl(152, 60%, 45%)" fill="hsl(152, 60%, 45%)" fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === "line" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Évolution mensuelle par catégorie</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  {Object.keys(CAT_LABELS).map(cat => (
                    <Line key={cat} type="monotone" dataKey={cat} name={CAT_LABELS[cat]} stroke={CAT_COLORS[cat]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Résultat net cumulé</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line type="monotone" dataKey="Résultat mensuel" stroke="hsl(152, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Résultat cumulé" stroke="hsl(210, 65%, 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === "pie" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Répartition par catégorie (valeur absolue)</p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Revenus vs Total charges</p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Revenus", value: pieData.find(d => d.name === "Revenus")?.value || 0, color: CAT_COLORS.revenue },
                      { name: "Charges totales", value: (pieData.find(d => d.name === "Charges fixes")?.value || 0) + (pieData.find(d => d.name === "Charges variables")?.value || 0), color: CAT_COLORS.fixed_charges },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {[CAT_COLORS.revenue, CAT_COLORS.fixed_charges].map((color, idx) => (
                      <Cell key={idx} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
