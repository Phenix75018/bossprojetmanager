import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Trash2, Pencil } from "lucide-react";

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface Props {
  id: string;
  chartType: "bar" | "pie";
  title: string;
  data: ChartDataPoint[];
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function BPChartRenderer({ id, chartType, title, data, editable, onEdit, onDelete }: Props) {
  return (
    <div className="my-6 p-4 rounded-xl border border-border bg-card" id={`bp-chart-${id}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {editable && (
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="w-full h-[280px]">
        {chartType === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || `hsl(${(idx * 60) % 360}, 65%, 50%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={{ strokeWidth: 1 }}
              >
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || `hsl(${(idx * 60) % 360}, 65%, 50%)`} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
