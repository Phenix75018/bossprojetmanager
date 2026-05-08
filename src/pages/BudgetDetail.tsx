import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, Wand2, Download, Share2, Plus, Trash2,
  DollarSign, TrendingUp, TrendingDown, PiggyBank, Building2,
  ChevronDown, ChevronRight, Save, Sparkles
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useBudgets, BudgetRow, BudgetLineRow } from "@/hooks/useBudgets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportBudgetPDF } from "@/lib/budgetPdfExport";
import ShareBudgetModal from "@/components/ShareBudgetModal";
import BudgetCharts from "@/components/BudgetCharts";
import BudgetSynthesis from "@/components/BudgetSynthesis";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";

const CATEGORIES = [
  { key: "revenue", label: "Revenus / Chiffre d'affaires", icon: TrendingUp, color: "text-emerald-600" },
  { key: "fixed_charges", label: "Charges fixes", icon: Building2, color: "text-red-500" },
  { key: "variable_charges", label: "Charges variables", icon: TrendingDown, color: "text-orange-500" },
  { key: "treasury", label: "Trésorerie", icon: PiggyBank, color: "text-blue-500" },
  { key: "investments", label: "Investissements", icon: DollarSign, color: "text-purple-500" },
];

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function getMonthLabel(index: number): string {
  return MONTH_LABELS[index % 12] + (index >= 12 ? ` A${Math.floor(index / 12) + 1}` : "");
}

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const { fetchBudgetWithLines, upsertLines, updateLine, addLine, deleteLine, enableSharing, updateBudgetStatus } = useBudgets();
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [lines, setLines] = useState<BudgetLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>(CATEGORIES.map(c => c.key));
  const [showShare, setShowShare] = useState(false);
  const [editingCell, setEditingCell] = useState<{ lineId: string; month: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [coherenceJustifs, setCoherenceJustifs] = useState<string[]>([]);
  const { versions, saveVersion, deleteVersion } = useDocumentVersions("budget", id);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await fetchBudgetWithLines(id);
    if (result) {
      setBudget(result.budget);
      setLines(result.lines);
    }
    setLoading(false);
  }, [id, fetchBudgetWithLines]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleCat = (key: string) => {
    setExpandedCats(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const generateAll = async () => {
    if (!budget) return;
    setGenerating("all");
    try {
      const { data, error } = await supabase.functions.invoke("generate-budget", {
        body: {
          projectDescription: budget.description,
          title: budget.title,
          horizonMonths: budget.horizon_months,
          projectId: budget.project_id,
        },
      });
      if (error) throw error;
      if (data?.lines) {
        await upsertLines(budget.id, data.lines);
        await updateBudgetStatus(budget.id, "in_progress");
        if (Array.isArray(data.coherence_justifications)) setCoherenceJustifs(data.coherence_justifications);
        await loadData();
        toast.success("Budget généré avec succès !");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération");
    }
    setGenerating(null);
  };

  const generateCategory = async (category: string) => {
    if (!budget) return;
    setGenerating(category);
    try {
      const { data, error } = await supabase.functions.invoke("generate-budget", {
        body: {
          projectDescription: budget.description,
          title: budget.title,
          horizonMonths: budget.horizon_months,
          sectionCategory: category,
          projectId: budget.project_id,
        },
      });
      if (error) throw error;
      if (data?.lines) {
        // Remove existing lines for this category
        const existingCatLines = lines.filter(l => l.category === category);
        for (const l of existingCatLines) {
          await deleteLine(l.id);
        }
        const maxOrder = Math.max(0, ...lines.map(l => l.sort_order));
        for (let i = 0; i < data.lines.length; i++) {
          await addLine(budget.id, { ...data.lines[i], sort_order: maxOrder + i + 1 });
        }
        if (Array.isArray(data.coherence_justifications)) setCoherenceJustifs(data.coherence_justifications);
        await loadData();
        toast.success("Catégorie générée !");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération");
    }
    setGenerating(null);
  };

  const handleAddLine = async (category: string) => {
    if (!budget) return;
    const maxOrder = Math.max(0, ...lines.filter(l => l.category === category).map(l => l.sort_order));
    const newLine = await addLine(budget.id, {
      category,
      label: "Nouvelle ligne",
      monthly_values: Array(budget.horizon_months).fill(0),
      sort_order: maxOrder + 1,
    });
    if (newLine) setLines(prev => [...prev, newLine]);
  };

  const handleDeleteLine = async (lineId: string) => {
    await deleteLine(lineId);
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const startEdit = (lineId: string, month: number, value: number) => {
    setEditingCell({ lineId, month });
    setEditValue(String(value));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const line = lines.find(l => l.id === editingCell.lineId);
    if (!line) return;
    const newValues = [...(line.monthly_values as number[])];
    newValues[editingCell.month] = parseFloat(editValue) || 0;
    await updateLine(editingCell.lineId, { monthly_values: newValues });
    setLines(prev => prev.map(l => l.id === editingCell.lineId ? { ...l, monthly_values: newValues } : l));
    setEditingCell(null);
  };

  const handleLabelChange = async (lineId: string, label: string) => {
    await updateLine(lineId, { label });
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, label } : l));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 text-center">
          <p className="text-muted-foreground">Budget introuvable</p>
          <Link to="/budgets" className="text-primary underline mt-4 inline-block">Retour aux budgets</Link>
        </div>
      </div>
    );
  }

  // Compute totals per category
  const categoryTotals = CATEGORIES.map(cat => {
    const catLines = lines.filter(l => l.category === cat.key && !l.is_total);
    const total = catLines.reduce((sum, l) => {
      const vals = (l.monthly_values as number[]) || [];
      return sum + vals.reduce((a, b) => a + b, 0);
    }, 0);
    return { ...cat, total, count: catLines.length };
  });

  const horizonMonths = budget.horizon_months;
  const visibleMonths = Math.min(horizonMonths, 12);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12 max-w-full px-4 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/budgets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" />
              Retour aux budgets
            </Link>
            <h1 className="text-2xl font-display font-black">{budget.title}</h1>
            <p className="text-sm text-muted-foreground">{budget.description} · {budget.horizon_months} mois</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={generateAll} disabled={!!generating} className="gap-2">
              {generating === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Générer tout
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportBudgetPDF(budget, lines)} className="gap-2">
              <Download className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)} className="gap-2">
              <Share2 className="w-4 h-4" />
              Partager
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {categoryTotals.map(cat => (
            <div key={cat.key} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <cat.icon className={`w-4 h-4 ${cat.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
              </div>
              <p className={`text-lg font-bold ${cat.total < 0 ? "text-destructive" : "text-foreground"}`}>
                {cat.total.toLocaleString("fr-FR")} €
              </p>
              <p className="text-xs text-muted-foreground">{cat.count} ligne{cat.count > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <BudgetCharts lines={lines} horizonMonths={horizonMonths} />
        <BudgetSynthesis lines={lines} horizonMonths={horizonMonths} />

        {/* Budget tables per category */}
        <div className="space-y-4 mt-6">
          {CATEGORIES.map(cat => {
            const catLines = lines.filter(l => l.category === cat.key);
            const expanded = expandedCats.includes(cat.key);

            return (
              <motion.div key={cat.key} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCat(cat.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <cat.icon className={`w-5 h-5 ${cat.color}`} />
                    <span className="font-display font-bold">{cat.label}</span>
                    <span className="text-xs text-muted-foreground">({catLines.length} lignes)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={e => { e.stopPropagation(); generateCategory(cat.key); }}
                      disabled={!!generating}
                      className="gap-1 text-xs"
                    >
                      {generating === cat.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      IA
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={e => { e.stopPropagation(); handleAddLine(cat.key); }}
                      className="gap-1 text-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Ligne
                    </Button>
                  </div>
                </button>

                {expanded && catLines.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground min-w-[180px] sticky left-0 bg-muted/30">Libellé</th>
                          {Array.from({ length: visibleMonths }, (_, i) => (
                            <th key={i} className="text-right px-2 py-2 font-medium text-muted-foreground min-w-[80px]">
                              {getMonthLabel(i)}
                            </th>
                          ))}
                          <th className="text-right px-4 py-2 font-bold text-muted-foreground min-w-[100px]">Total</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {catLines.map(line => {
                          const values = (line.monthly_values as number[]) || [];
                          const total = values.slice(0, visibleMonths).reduce((a, b) => a + b, 0);

                          return (
                            <tr key={line.id} className={`border-t ${line.is_total ? "bg-muted/50 font-bold" : "hover:bg-muted/20"}`}>
                              <td className="px-4 py-1.5 sticky left-0 bg-background">
                                <Input
                                  value={line.label}
                                  onChange={e => handleLabelChange(line.id, e.target.value)}
                                  className="h-7 text-sm border-none bg-transparent px-0 font-medium"
                                />
                              </td>
                              {Array.from({ length: visibleMonths }, (_, m) => {
                                const val = values[m] || 0;
                                const isEditing = editingCell?.lineId === line.id && editingCell?.month === m;
                                return (
                                  <td key={m} className="px-1 py-1.5 text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={saveEdit}
                                        onKeyDown={e => e.key === "Enter" && saveEdit()}
                                        className="h-7 text-sm text-right w-20"
                                        autoFocus
                                      />
                                    ) : (
                                      <button
                                        onClick={() => !line.is_total && startEdit(line.id, m, val)}
                                        className={`text-xs px-1 py-0.5 rounded hover:bg-muted/50 ${val < 0 ? "text-destructive" : "text-foreground"}`}
                                      >
                                        {val.toLocaleString("fr-FR")}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                              <td className={`px-4 py-1.5 text-right font-bold text-xs ${total < 0 ? "text-destructive" : "text-foreground"}`}>
                                {total.toLocaleString("fr-FR")} €
                              </td>
                              <td className="px-2 py-1.5">
                                {!line.is_total && (
                                  <button onClick={() => handleDeleteLine(line.id)} className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {expanded && catLines.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm border-t">
                    Aucune ligne. Cliquez sur "IA" pour générer ou "Ligne" pour ajouter manuellement.
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Version history */}
      <div className="max-w-full px-4 lg:px-8 mb-8">
        <VersionHistoryPanel
          versions={versions}
          loading={false}
          onSaveVersion={async (label) => {
            await saveVersion({ budget, lines: lines.map(l => ({ category: l.category, subcategory: l.subcategory, label: l.label, monthly_values: l.monthly_values, is_total: l.is_total, sort_order: l.sort_order })) }, label);
          }}
          onRestoreVersion={async (snapshot: any) => {
            if (snapshot.lines && id) {
              await upsertLines(id, snapshot.lines);
              await loadData();
              toast.success("Version restaurée !");
            }
          }}
          onDeleteVersion={deleteVersion}
          documentType="budget"
        />
      </div>

      <ShareBudgetModal
        open={showShare}
        onOpenChange={setShowShare}
        onShare={(pw) => enableSharing(budget!.id, pw)}
        existingToken={budget?.share_token}
      />
    </div>
  );
}
