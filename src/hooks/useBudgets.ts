import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BudgetRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string;
  status: string;
  horizon_months: number;
  share_token: string | null;
  share_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetLineRow {
  id: string;
  budget_id: string;
  category: string;
  subcategory: string;
  label: string;
  monthly_values: number[];
  is_total: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useBudgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBudgets = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("budgets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur lors du chargement des budgets");
      console.error(error);
    } else {
      setBudgets((data as unknown as BudgetRow[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const fetchBudgetWithLines = useCallback(async (budgetId: string) => {
    if (!user) return null;
    const { data: budget, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .single();
    if (error || !budget) return null;

    const { data: lines } = await supabase
      .from("budget_lines")
      .select("*")
      .eq("budget_id", budgetId)
      .order("sort_order");

    return { budget: budget as unknown as BudgetRow, lines: (lines as unknown as BudgetLineRow[]) || [] };
  }, [user]);

  const createBudget = useCallback(async (title: string, description: string, horizonMonths: number, projectId?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        title,
        description,
        horizon_months: horizonMonths,
        project_id: projectId || null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de la création");
      return null;
    }
    await fetchBudgets();
    return (data as unknown as BudgetRow).id;
  }, [user, fetchBudgets]);

  const deleteBudget = useCallback(async (budgetId: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setBudgets(prev => prev.filter(b => b.id !== budgetId));
      toast.success("Budget supprimé");
    }
  }, []);

  const updateBudgetStatus = useCallback(async (budgetId: string, status: string) => {
    await supabase.from("budgets").update({ status }).eq("id", budgetId);
  }, []);

  const upsertLines = useCallback(async (budgetId: string, lines: Omit<BudgetLineRow, "id" | "budget_id" | "created_at" | "updated_at">[]) => {
    await supabase.from("budget_lines").delete().eq("budget_id", budgetId);
    const toInsert = lines.map((l, i) => ({
      budget_id: budgetId,
      category: l.category,
      subcategory: l.subcategory || "",
      label: l.label,
      monthly_values: l.monthly_values,
      is_total: l.is_total || false,
      sort_order: i,
    }));
    const { error } = await supabase.from("budget_lines").insert(toInsert);
    if (error) toast.error("Erreur lors de la sauvegarde des lignes");
  }, []);

  const updateLine = useCallback(async (lineId: string, updates: Partial<Pick<BudgetLineRow, "label" | "monthly_values" | "category" | "subcategory">>) => {
    const { error } = await supabase.from("budget_lines").update(updates).eq("id", lineId);
    if (error) toast.error("Erreur lors de la mise à jour");
  }, []);

  const addLine = useCallback(async (budgetId: string, line: { category: string; subcategory?: string; label: string; monthly_values: number[]; is_total?: boolean; sort_order: number }) => {
    const { data, error } = await supabase
      .from("budget_lines")
      .insert({
        budget_id: budgetId,
        category: line.category,
        subcategory: line.subcategory || "",
        label: line.label,
        monthly_values: line.monthly_values,
        is_total: line.is_total || false,
        sort_order: line.sort_order,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de l'ajout");
      return null;
    }
    return data as unknown as BudgetLineRow;
  }, []);

  const deleteLine = useCallback(async (lineId: string) => {
    const { error } = await supabase.from("budget_lines").delete().eq("id", lineId);
    if (error) toast.error("Erreur lors de la suppression");
  }, []);

  const enableSharing = useCallback(async (budgetId: string, password?: string) => {
    const shareToken = crypto.randomUUID();
    const updates: Record<string, unknown> = { share_token: shareToken };
    if (password) updates.share_password = password;
    const { error } = await supabase.from("budgets").update(updates).eq("id", budgetId);
    if (error) {
      toast.error("Erreur lors de l'activation du partage");
      return null;
    }
    return shareToken;
  }, []);

  return {
    budgets, loading, fetchBudgets, fetchBudgetWithLines, createBudget,
    deleteBudget, updateBudgetStatus, upsertLines, updateLine, addLine, deleteLine, enableSharing,
  };
}
