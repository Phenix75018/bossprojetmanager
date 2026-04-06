import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, DollarSign, Lock, TrendingUp, TrendingDown, Building2, PiggyBank, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BudgetRow, BudgetLineRow } from "@/hooks/useBudgets";

const CATEGORIES = [
  { key: "revenue", label: "Revenus / Chiffre d'affaires", icon: TrendingUp, color: "text-emerald-600" },
  { key: "fixed_charges", label: "Charges fixes", icon: Building2, color: "text-red-500" },
  { key: "variable_charges", label: "Charges variables", icon: TrendingDown, color: "text-orange-500" },
  { key: "treasury", label: "Trésorerie", icon: PiggyBank, color: "text-blue-500" },
  { key: "investments", label: "Investissements", icon: DollarSign, color: "text-purple-500" },
];

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
function getMonthLabel(i: number) { return MONTH_LABELS[i % 12] + (i >= 12 ? ` A${Math.floor(i / 12) + 1}` : ""); }

export default function SharedBudget() {
  const { token } = useParams<{ token: string }>();
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [lines, setLines] = useState<BudgetLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [expandedCats, setExpandedCats] = useState<string[]>(CATEGORIES.map(c => c.key));

  const fetchShared = async (pw?: string) => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.functions.invoke("get-shared-budget", {
      body: { token, password: pw },
    });
    if (err) {
      setError("Erreur de chargement");
    } else if (data?.error === "password_required") {
      setNeedsPassword(true);
    } else if (data?.error) {
      setError(data.error);
    } else {
      setBudget(data.budget);
      setLines(data.lines || []);
      setNeedsPassword(false);
    }
    setLoading(false);
  };

  useEffect(() => { fetchShared(); }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
          <Lock className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Budget protégé</h2>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={() => fetchShared(password)} className="w-full gradient-bg text-primary-foreground">Accéder</Button>
        </div>
      </div>
    );
  }

  if (error || !budget) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error || "Budget introuvable"}</div>;
  }

  const visibleMonths = Math.min(budget.horizon_months, 12);

  return (
    <div className="min-h-screen bg-background">
      <div className="container pt-12 pb-12 max-w-full px-4 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-black">{budget.title}</h1>
          <p className="text-muted-foreground">{budget.description} · {budget.horizon_months} mois</p>
        </div>

        <div className="space-y-4">
          {CATEGORIES.map(cat => {
            const catLines = lines.filter(l => l.category === cat.key);
            if (catLines.length === 0) return null;
            const expanded = expandedCats.includes(cat.key);

            return (
              <div key={cat.key} className="glass-card rounded-xl overflow-hidden">
                <button onClick={() => setExpandedCats(prev => prev.includes(cat.key) ? prev.filter(k => k !== cat.key) : [...prev, cat.key])} className="w-full flex items-center gap-3 p-4 hover:bg-muted/50">
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <cat.icon className={`w-5 h-5 ${cat.color}`} />
                  <span className="font-bold">{cat.label}</span>
                </button>
                {expanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t bg-muted/30">
                          <th className="text-left px-4 py-2 min-w-[180px]">Libellé</th>
                          {Array.from({ length: visibleMonths }, (_, i) => (
                            <th key={i} className="text-right px-2 py-2 min-w-[80px]">{getMonthLabel(i)}</th>
                          ))}
                          <th className="text-right px-4 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catLines.map(line => {
                          const vals = (line.monthly_values as number[]) || [];
                          const total = vals.slice(0, visibleMonths).reduce((a, b) => a + b, 0);
                          return (
                            <tr key={line.id} className={`border-t ${line.is_total ? "bg-muted/50 font-bold" : ""}`}>
                              <td className="px-4 py-1.5">{line.label}</td>
                              {Array.from({ length: visibleMonths }, (_, m) => (
                                <td key={m} className={`px-2 py-1.5 text-right text-xs ${(vals[m] || 0) < 0 ? "text-destructive" : ""}`}>
                                  {(vals[m] || 0).toLocaleString("fr-FR")}
                                </td>
                              ))}
                              <td className={`px-4 py-1.5 text-right font-bold ${total < 0 ? "text-destructive" : ""}`}>
                                {total.toLocaleString("fr-FR")} €
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
