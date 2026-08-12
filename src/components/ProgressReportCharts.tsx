import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, TrendingDown } from "lucide-react";
import type { ProgressReportCharts as ChartsData } from "@/lib/progressReportPdf";

const COLORS = {
  primary: "hsl(var(--primary))",
  amber: "hsl(38 78% 47%)",
  teal: "hsl(174 42% 42%)",
  muted: "hsl(var(--muted-foreground))",
  destructive: "hsl(var(--destructive))",
};

const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11 };

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

function Card({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-2xl p-5 border border-border/50">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      {hint && <p className="text-xs text-muted-foreground mb-3">{hint}</p>}
      <div className="h-56 -ml-2">{children}</div>
    </section>
  );
}

export default function ProgressReportCharts({ charts }: { charts?: ChartsData | null }) {
  if (!charts) return null;
  const trend = charts.progressTrend ?? [];
  const phases = charts.phaseProgress ?? [];
  const budget = charts.budgetMonthly ?? [];

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {trend.length > 1 && (
        <Card
          title="Tendance d'avancement"
          hint="Tâches terminées cumulées vs. rythme cible sur la période"
          icon={<Activity className="w-4 h-4 text-primary" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" {...axis} tickLine={false} interval="preserveStartEnd" />
              <YAxis {...axis} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="doneCumul"
                name="Terminées (cumul)"
                stroke={COLORS.primary}
                fill="url(#gradDone)"
                strokeWidth={2}
              />
              <Line type="monotone" dataKey="target" name="Rythme cible" stroke={COLORS.amber} strokeDasharray="5 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {trend.length > 1 && (
        <Card
          title="Burndown (charge restante)"
          hint="Heures restantes réelles vs. trajectoire idéale"
          icon={<TrendingDown className="w-4 h-4 text-primary" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" {...axis} tickLine={false} interval="preserveStartEnd" />
              <YAxis {...axis} tickLine={false} width={38} unit=" h" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v} h`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="remainingHours"
                name="Restant réel"
                stroke={COLORS.destructive}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="idealHours"
                name="Trajectoire idéale"
                stroke={COLORS.teal}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {budget.length > 0 && (
        <Card
          title="Écarts budgétaires"
          hint="Revenus vs. charges par mois et résultat net"
          icon={<BarChart3 className="w-4 h-4 text-primary" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budget}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" {...axis} tickLine={false} interval="preserveStartEnd" />
              <YAxis {...axis} tickLine={false} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => `${Math.round(Number(v)).toLocaleString("fr-FR")} €`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenus" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
              <Bar dataKey="charges" name="Charges" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="net" name="Résultat net" stroke={COLORS.primary} strokeWidth={2} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {budget.length > 0 && (
        <Card
          title="Trésorerie cumulée"
          hint="Résultat net cumulé sur l'horizon budgétaire"
          icon={<Activity className="w-4 h-4 text-primary" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={budget}>
              <defs>
                <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" {...axis} tickLine={false} interval="preserveStartEnd" />
              <YAxis {...axis} tickLine={false} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => `${Math.round(Number(v)).toLocaleString("fr-FR")} €`}
              />
              <Area
                type="monotone"
                dataKey="cumulNet"
                name="Net cumulé"
                stroke={COLORS.primary}
                fill="url(#gradCash)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {phases.length > 0 && (
        <Card
          title="Avancement par phase"
          hint="Répartition des tâches par statut"
          icon={<BarChart3 className="w-4 h-4 text-primary" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={phases} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" {...axis} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...axis} tickLine={false} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="done" name="Terminées" stackId="s" fill={COLORS.teal} />
              <Bar dataKey="inProgress" name="En cours" stackId="s" fill={COLORS.amber} />
              <Bar dataKey="todo" name="À faire" stackId="s" fill="hsl(var(--muted))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
