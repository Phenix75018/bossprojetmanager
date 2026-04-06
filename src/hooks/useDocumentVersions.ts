import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DocumentVersion {
  id: string;
  user_id: string;
  document_type: string;
  document_id: string;
  version_number: number;
  label: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export function useDocumentVersions(documentType: string, documentId: string | undefined) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!user || !documentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_type", documentType)
      .eq("document_id", documentId)
      .order("version_number", { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setVersions((data as unknown as DocumentVersion[]) || []);
    }
    setLoading(false);
  }, [user, documentType, documentId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const saveVersion = useCallback(async (snapshot: Record<string, unknown>, label?: string) => {
    if (!user || !documentId) return null;
    const nextNumber = versions.length > 0 ? versions[0].version_number + 1 : 1;
    const { data, error } = await supabase
      .from("document_versions")
      .insert({
        user_id: user.id,
        document_type: documentType,
        document_id: documentId,
        version_number: nextNumber,
        label: label || `Version ${nextNumber}`,
        snapshot,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de la sauvegarde de la version");
      console.error(error);
      return null;
    }
    const version = data as unknown as DocumentVersion;
    setVersions(prev => [version, ...prev]);
    toast.success(`Version ${nextNumber} sauvegardée`);
    return version;
  }, [user, documentType, documentId, versions]);

  const deleteVersion = useCallback(async (versionId: string) => {
    const { error } = await supabase.from("document_versions").delete().eq("id", versionId);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setVersions(prev => prev.filter(v => v.id !== versionId));
      toast.success("Version supprimée");
    }
  }, []);

  return { versions, loading, fetchVersions, saveVersion, deleteVersion };
}
