import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BusinessPlanRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string;
  status: string;
  share_token: string | null;
  share_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface BPSectionRow {
  id: string;
  business_plan_id: string;
  section_type: string;
  title: string;
  content: string;
  sort_order: number;
  generated: boolean;
  created_at: string;
  updated_at: string;
}

export function useBusinessPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<BusinessPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("business_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur lors du chargement des business plans");
      console.error(error);
    } else {
      setPlans((data as BusinessPlanRow[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const fetchPlanWithSections = useCallback(async (planId: string) => {
    if (!user) return null;
    const { data: plan, error } = await supabase
      .from("business_plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (error || !plan) return null;

    const { data: sections } = await supabase
      .from("business_plan_sections")
      .select("*")
      .eq("business_plan_id", planId)
      .order("sort_order");

    return { plan: plan as BusinessPlanRow, sections: (sections as BPSectionRow[]) || [] };
  }, [user]);

  const createPlan = useCallback(async (title: string, description: string, projectId?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("business_plans")
      .insert({
        user_id: user.id,
        title,
        description,
        project_id: projectId || null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de la création");
      return null;
    }
    await fetchPlans();
    return (data as BusinessPlanRow).id;
  }, [user, fetchPlans]);

  const updateSection = useCallback(async (sectionId: string, content: string) => {
    const { error } = await supabase
      .from("business_plan_sections")
      .update({ content })
      .eq("id", sectionId);
    if (error) toast.error("Erreur lors de la sauvegarde");
  }, []);

  const upsertSections = useCallback(async (planId: string, sections: { section_type: string; title: string; content: string; sort_order: number }[]) => {
    // Delete existing sections and insert new ones
    await supabase.from("business_plan_sections").delete().eq("business_plan_id", planId);
    const toInsert = sections.map(s => ({
      business_plan_id: planId,
      section_type: s.section_type,
      title: s.title,
      content: s.content,
      sort_order: s.sort_order,
      generated: true,
    }));
    const { error } = await supabase.from("business_plan_sections").insert(toInsert);
    if (error) toast.error("Erreur lors de la sauvegarde des sections");
  }, []);

  const addSection = useCallback(async (planId: string, sectionType: string, title: string, content: string, sortOrder: number) => {
    const { data, error } = await supabase
      .from("business_plan_sections")
      .insert({
        business_plan_id: planId,
        section_type: sectionType,
        title,
        content,
        sort_order: sortOrder,
        generated: true,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de l'ajout de la section");
      return null;
    }
    return data as BPSectionRow;
  }, []);

  const deletePlan = useCallback(async (planId: string) => {
    const { error } = await supabase.from("business_plans").delete().eq("id", planId);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setPlans(prev => prev.filter(p => p.id !== planId));
      toast.success("Business plan supprimé");
    }
  }, []);

  const updatePlanStatus = useCallback(async (planId: string, status: string) => {
    await supabase.from("business_plans").update({ status }).eq("id", planId);
  }, []);

  const enableSharing = useCallback(async (planId: string, password?: string) => {
    const shareToken = crypto.randomUUID();
    const updates: any = { share_token: shareToken };
    if (password) {
      // Hash password using pgcrypto via RPC if available, else store as-is for now
      updates.share_password = password;
    }
    const { error } = await supabase.from("business_plans").update(updates).eq("id", planId);
    if (error) {
      toast.error("Erreur lors de l'activation du partage");
      return null;
    }
    return shareToken;
  }, []);

  return {
    plans, loading, fetchPlans, fetchPlanWithSections, createPlan,
    updateSection, upsertSections, addSection, deletePlan, updatePlanStatus, enableSharing,
  };
}
