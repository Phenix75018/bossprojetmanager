import { useState } from "react";
import { X, Plus, Trash2, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  id?: string;
  chart_type: "bar" | "pie";
  title: string;
  chart_data: ChartDataPoint[];
}

const DEFAULT_COLORS = [
  "hsl(210, 70%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(40, 85%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(190, 70%, 45%)",
  "hsl(20, 80%, 55%)",
  "hsl(100, 55%, 45%)",
];

interface Props {
  open: boolean;
  initial?: ChartConfig | null;
  onSave: (config: ChartConfig) => void;
  onClose: () => void;
}

export default function BPChartEditor({ open, initial, onSave, onClose }: Props) {
  const [chartType, setChartType] = useState<"bar" | "pie">(initial?.chart_type || "bar");
  const [title, setTitle] = useState(initial?.title || "");
  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>(
    initial?.chart_data?.length ? initial.chart_data : [
      { name: "Catégorie 1", value: 100, color: DEFAULT_COLORS[0] },
      { name: "Catégorie 2", value: 200, color: DEFAULT_COLORS[1] },
      { name: "Catégorie 3", value: 150, color: DEFAULT_COLORS[2] },
    ]
  );

  const addPoint = () => {
    setDataPoints(prev => [
      ...prev,
      { name: `Catégorie ${prev.length + 1}`, value: 0, color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] },
    ]);
  };

  const removePoint = (idx: number) => {
    setDataPoints(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePoint = (idx: number, field: keyof ChartDataPoint, val: string | number) => {
    setDataPoints(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  const handleSave = () => {
    if (!title.trim() || dataPoints.length === 0) return;
    onSave({
      id: initial?.id,
      chart_type: chartType,
      title: title.trim(),
      chart_data: dataPoints.map((p, i) => ({ ...p, color: p.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier le graphique" : "Ajouter un graphique"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chart type */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Type de graphique</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType("bar")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  chartType === "bar" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Barres
              </button>
              <button
                onClick={() => setChartType("pie")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  chartType === "pie" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
                Camembert
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs font-medium">Titre du graphique</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Répartition du chiffre d'affaires" className="mt-1" />
          </div>

          {/* Data points */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Données ({dataPoints.length} entrées)</Label>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {dataPoints.map((pt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={pt.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    onChange={e => updatePoint(idx, "color", e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer flex-shrink-0"
                  />
                  <Input
                    value={pt.name}
                    onChange={e => updatePoint(idx, "name", e.target.value)}
                    placeholder="Nom"
                    className="flex-1 text-sm"
                  />
                  <Input
                    type="number"
                    value={pt.value}
                    onChange={e => updatePoint(idx, "value", parseFloat(e.target.value) || 0)}
                    className="w-24 text-sm"
                  />
                  <button onClick={() => removePoint(idx)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addPoint} className="mt-2 gap-1.5 w-full">
              <Plus className="w-3.5 h-3.5" /> Ajouter une entrée
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={!title.trim() || dataPoints.length === 0}>
            {initial?.id ? "Mettre à jour" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
