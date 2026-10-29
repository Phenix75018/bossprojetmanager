import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, GitCompare, History, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import VersionCompareDialog from "@/components/VersionCompareDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { DocumentVersion } from "@/hooks/useDocumentVersions";
import { DOC_LABELS, DocType, restoreDocVersion, saveDocVersion } from "@/lib/projectVersions";

interface Doc { type: DocType; id: string; title: string; link: string }

export default function ProjectHistory() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [projectTitle, setProjectTitle] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [filter, setFilter] = useState<"all" | DocType>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ doc: Doc; pair?: [string, string] } | null>(null);
  const [toRestore, setToRestore] = useState<DocumentVersion | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: p }, { data: bps }, { data: bms }, { data: bus }] = await Promise.all([
      supabase.from("projects").select("title").eq("id", id).maybeSingle(),
      supabase.from("business_plans").select("id,title").eq("project_id", id),
      supabase.from("business_models").select("id,title").eq("project_id", id),
      supabase.from("budgets").select("id,title").eq("project_id", id),
    ]);
    setProjectTitle(p?.title ?? "");
    const list: Doc[] = [
      { type: "plan", id, title: p?.title ?? "Plan d'action", link: `/plan/${id}` },
      ...(bps ?? []).map(d => ({ type: "business_plan" as DocType, id: d.id, title: d.title, link: `/business-plan/${d.id}` })),
      ...(bms ?? []).map(d => ({ type: "business_model" as DocType, id: d.id, title: d.title, link: `/business-model/${d.id}` })),
      ...(bus ?? []).map(d => ({ type: "budget" as DocType, id: d.id, title: d.title, link: `/budget/${d.id}` })),
    ];
    setDocs(list);
    const { data: vs } = await supabase.from("document_versions").select("*")
      .in("document_id", list.map(d => d.id)).order("created_at", { ascending: false });
    setVersions((vs as unknown as DocumentVersion[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const docOf = (v: DocumentVersion) => docs.find(d => d.id === v.document_id && d.type === v.document_type);
  const shown = useMemo(() => versions.filter(v => docOf(v) && (filter === "all" || v.document_type === filter)), [versions, docs, filter]);

  const snapshotAll = async () => {
    if (!user || !id) return;
    setBusy("all");
    try {
      const stamp = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      for (const d of docs) await saveDocVersion(user.id, d.type, d.id, id, `Point projet · ${stamp}`);
      toast.success(`${docs.length} document(s) versionné(s)`);
      await load();
    } catch (e) { console.error(e); toast.error("Erreur lors de la sauvegarde"); }
    setBusy(null);
  };

  const doRestore = async (v: DocumentVersion) => {
    if (!user || !id) return;
    setBusy(v.id);
    try {
      await saveDocVersion(user.id, v.document_type as DocType, v.document_id, id, "Sauvegarde auto avant restauration");
      await restoreDocVersion(v.document_type as DocType, v.document_id, v.snapshot);
      toast.success(`${DOC_LABELS[v.document_type as DocType]} restauré à la v${v.version_number} (KPIs inclus)`);
      await load();
    } catch (e) { console.error(e); toast.error("La restauration a échoué"); }
    setBusy(null);
  };

  const openBeforeAfter = (v: DocumentVersion) => {
    const doc = docOf(v)!;
    const tag = v.label.replace(/^Après génération — /, "");
    const before = versions.find(x => x.document_id === v.document_id && x.label === `Avant génération — ${tag}`);
    const prev = before ?? versions
      .filter(x => x.document_id === v.document_id && x.version_number < v.version_number)
      .sort((a, b) => b.version_number - a.version_number)[0];
    setCompare({ doc, pair: prev ? [prev.id, v.id] : undefined });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12 max-w-4xl">
        <Link to={`/plan/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Retour au projet
        </Link>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-black flex items-center gap-2"><History className="w-7 h-7 text-primary" /> Historique des versions</h1>
            <p className="text-muted-foreground text-sm mt-1">{projectTitle} — plan d'action, business plan, business model et budget</p>
          </div>
          <Button onClick={snapshotAll} disabled={busy !== null || loading}>
            {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Sauvegarder tout le projet
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {(["all", "plan", "business_plan", "business_model", "budget"] as const).map(t => (
            <Button key={t} size="sm" variant={filter === t ? "default" : "outline"} onClick={() => setFilter(t)}>
              {t === "all" ? "Tout" : DOC_LABELS[t]}
            </Button>
          ))}
          <div className="flex-1" />
          {docs.filter(d => filter === "all" || d.type === filter).map(d => (
            <Button key={d.id} size="sm" variant="ghost" onClick={() => setCompare({ doc: d })}>
              <GitCompare className="w-4 h-4" /> Comparer {DOC_LABELS[d.type]}{docs.filter(x => x.type === d.type).length > 1 ? ` · ${d.title}` : ""}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm border border-dashed rounded-xl">
            Aucune version pour l'instant. Cliquez sur « Sauvegarder tout le projet » pour créer un premier point.
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(v => {
              const doc = docOf(v)!;
              return (
                <div key={v.id} className="flex items-center gap-3 border rounded-xl p-3 bg-card">
                  <Badge variant="secondary" className="shrink-0">{DOC_LABELS[doc.type]}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">v{v.version_number} — {v.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      <Link to={doc.link} className="hover:underline">{doc.title}</Link> · {new Date(v.created_at).toLocaleString("fr-FR")}
                      {(v.snapshot as any)?.__kpis ? " · KPIs inclus" : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openBeforeAfter(v)}>
                    <GitCompare className="w-4 h-4" /> Avant/après
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setToRestore(v)}>
                    {busy === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restaurer
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {compare && (
        <VersionCompareDialog
          open
          onOpenChange={o => !o && setCompare(null)}
          versions={versions.filter(v => v.document_id === compare.doc.id && v.document_type === compare.doc.type)}
          documentType={compare.doc.type}
          initialPair={compare.pair}
        />
      )}

      <AlertDialog open={!!toRestore} onOpenChange={o => !o && setToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRestore && `${DOC_LABELS[toRestore.document_type as DocType]} reviendra à la v${toRestore.version_number}, KPIs compris. L'état actuel est sauvegardé automatiquement avant, vous pourrez donc revenir en arrière.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const v = toRestore!; setToRestore(null); doRestore(v); }}>Restaurer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
