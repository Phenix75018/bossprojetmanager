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

/** Project KPIs / scenarios captured with each version so a restore brings them back. */
async function captureKpis(projectId?: string | null) {
  if (!projectId) return null;
  const { data } = await supabase
    .from("projects")
    .select("business_assumptions, assumption_scenarios, active_scenario")
    .eq("id", projectId)
    .maybeSingle();
  return data ? { projectId, ...data } : null;
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
    if (error) console.error(error);
    else setVersions((data as unknown as DocumentVersion[]) || []);
    setLoading(false);
  }, [user, documentType, documentId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const saveVersion = useCallback(async (
    snapshot: Record<string, unknown>,
    label?: string,
    opts?: { projectId?: string | null; silent?: boolean },
  ) => {
    if (!user || !documentId) return null;
    // Read the latest number from the database so back-to-back saves never collide
    const { data: last } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_type", documentType)
      .eq("document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (last?.version_number ?? 0) + 1;
    const kpis = await captureKpis(opts?.projectId);
    const { data, error } = await supabase
      .from("document_versions")
      .insert({
        user_id: user.id,
        document_type: documentType,
        document_id: documentId,
        version_number: nextNumber,
        label: label || `Version ${nextNumber}`,
        snapshot: (kpis ? { ...snapshot, __kpis: kpis } : snapshot) as any,
      } as any)
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de la sauvegarde de la version");
      console.error(error);
      return null;
    }
    const version = data as unknown as DocumentVersion;
    setVersions(prev => [version, ...prev]);
    if (!opts?.silent) toast.success(`Version ${nextNumber} sauvegardée`);
    return version;
  }, [user, documentType, documentId]);

  /** Saves "Avant génération" + "Après génération" versions around an AI generation. */
  const withGenerationVersions = useCallback(async (
    what: string,
    projectId: string | null | undefined,
    buildSnapshot: () => Promise<Record<string, unknown>>,
    run: () => Promise<boolean | void>,
  ) => {
    const stamp = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const tag = `${what} · ${stamp}`;
    await saveVersion(await buildSnapshot(), `Avant génération — ${tag}`, { projectId, silent: true });
    const ok = await run();
    if (ok === false) return;
    await saveVersion(await buildSnapshot(), `Après génération — ${tag}`, { projectId, silent: true });
  }, [saveVersion]);

  /** Restores project KPIs saved with a version (if any). */
  const restoreKpis = useCallback(async (snapshot: any) => {
    const k = snapshot?.__kpis;
    if (!k?.projectId) return false;
    const { error } = await supabase.from("projects").update({
      business_assumptions: k.business_assumptions,
      assumption_scenarios: k.assumption_scenarios,
      active_scenario: k.active_scenario,
    }).eq("id", k.projectId);
    if (error) { console.error(error); return false; }
    return true;
  }, []);

  const deleteVersion = useCallback(async (versionId: string) => {
    const { error } = await supabase.from("document_versions").delete().eq("id", versionId);
    if (error) toast.error("Erreur lors de la suppression");
    else {
      setVersions(prev => prev.filter(v => v.id !== versionId));
      toast.success("Version supprimée");
    }
  }, []);

  return { versions, loading, fetchVersions, saveVersion, deleteVersion, withGenerationVersions, restoreKpis };
}
