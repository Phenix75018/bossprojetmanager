import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BusinessModelRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string;
  framework: string;
  status: string;
  share_token: string | null;
  share_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface BMBlockRow {
  id: string;
  business_model_id: string;
  block_type: string;
  title: string;
  content: string;
  sort_order: number;
  generated: boolean;
  created_at: string;
  updated_at: string;
}

export function useBusinessModels() {
  const { user } = useAuth();
  const [models, setModels] = useState<BusinessModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("business_models")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur lors du chargement des business models");
      console.error(error);
    } else {
      setModels((data as BusinessModelRow[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const fetchModelWithBlocks = useCallback(async (modelId: string) => {
    if (!user) return null;
    const { data: model, error } = await supabase
      .from("business_models")
      .select("*")
      .eq("id", modelId)
      .single();
    if (error || !model) return null;

    const { data: blocks } = await supabase
      .from("business_model_blocks")
      .select("*")
      .eq("business_model_id", modelId)
      .order("sort_order");

    return { model: model as BusinessModelRow, blocks: (blocks as BMBlockRow[]) || [] };
  }, [user]);

  const createModel = useCallback(async (title: string, description: string, framework: string, projectId?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("business_models")
      .insert({
        user_id: user.id,
        title,
        description,
        framework,
        project_id: projectId || null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de la création");
      return null;
    }
    await fetchModels();
    return (data as BusinessModelRow).id;
  }, [user, fetchModels]);

  const updateBlock = useCallback(async (blockId: string, content: string) => {
    const { error } = await supabase
      .from("business_model_blocks")
      .update({ content })
      .eq("id", blockId);
    if (error) toast.error("Erreur lors de la sauvegarde");
  }, []);

  const upsertBlocks = useCallback(async (modelId: string, blocks: { block_type: string; title: string; content: string; sort_order: number }[]) => {
    await supabase.from("business_model_blocks").delete().eq("business_model_id", modelId);
    const toInsert = blocks.map(b => ({
      business_model_id: modelId,
      block_type: b.block_type,
      title: b.title,
      content: b.content,
      sort_order: b.sort_order,
      generated: true,
    }));
    const { error } = await supabase.from("business_model_blocks").insert(toInsert);
    if (error) toast.error("Erreur lors de la sauvegarde des blocs");
  }, []);

  const addBlock = useCallback(async (modelId: string, blockType: string, title: string, content: string, sortOrder: number) => {
    const { data, error } = await supabase
      .from("business_model_blocks")
      .insert({
        business_model_id: modelId,
        block_type: blockType,
        title,
        content,
        sort_order: sortOrder,
        generated: true,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de l'ajout du bloc");
      return null;
    }
    return data as BMBlockRow;
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    const { error } = await supabase.from("business_models").delete().eq("id", modelId);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setModels(prev => prev.filter(m => m.id !== modelId));
      toast.success("Business model supprimé");
    }
  }, []);

  const updateModelStatus = useCallback(async (modelId: string, status: string) => {
    await supabase.from("business_models").update({ status }).eq("id", modelId);
  }, []);

  const enableSharing = useCallback(async (modelId: string, password?: string) => {
    const shareToken = crypto.randomUUID();
    const updates: any = { share_token: shareToken };
    if (password) updates.share_password = password;
    const { error } = await supabase.from("business_models").update(updates).eq("id", modelId);
    if (error) {
      toast.error("Erreur lors de l'activation du partage");
      return null;
    }
    return shareToken;
  }, []);

  return {
    models, loading, fetchModels, fetchModelWithBlocks, createModel,
    updateBlock, upsertBlocks, addBlock, deleteModel, updateModelStatus, enableSharing,
  };
}
