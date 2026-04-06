import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, ChevronDown, ChevronRight, Trash2, RotateCcw, Save, Clock, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { DocumentVersion } from "@/hooks/useDocumentVersions";

interface VersionHistoryPanelProps {
  versions: DocumentVersion[];
  loading: boolean;
  onSaveVersion: (label?: string) => Promise<unknown>;
  onRestoreVersion: (snapshot: Record<string, unknown>) => void;
  onDeleteVersion: (versionId: string) => void;
}

export default function VersionHistoryPanel({
  versions,
  loading,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
}: VersionHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<DocumentVersion | null>(null);

  const handleSave = async () => {
    setSaving(true);
    await onSaveVersion(saveLabel || undefined);
    setSaving(false);
    setShowSaveDialog(false);
    setSaveLabel("");
  };

  const handleRestore = (version: DocumentVersion) => {
    setConfirmRestore(version);
  };

  const doRestore = () => {
    if (confirmRestore) {
      onRestoreVersion(confirmRestore.snapshot);
      setConfirmRestore(null);
    }
  };

  return (
    <>
      <div className="glass-card rounded-xl overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <History className="w-4 h-4 text-primary" />
            <span className="font-display font-bold text-sm">Historique des versions</span>
            <span className="text-xs text-muted-foreground">({versions.length})</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={e => { e.stopPropagation(); setShowSaveDialog(true); }}
            className="gap-1 text-xs"
          >
            <Save className="w-3 h-3" />
            Sauvegarder
          </Button>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {versions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm border-t">
                  Aucune version sauvegardée. Cliquez sur "Sauvegarder" pour créer un snapshot.
                </div>
              ) : (
                <div className="border-t divide-y max-h-80 overflow-y-auto">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">v{v.version_number}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">{v.label}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(v.created_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRestore(v)}
                          className="gap-1 text-xs h-7"
                          title="Restaurer cette version"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restaurer
                        </Button>
                        <button
                          onClick={() => onDeleteVersion(v.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sauvegarder une version</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              value={saveLabel}
              onChange={e => setSaveLabel(e.target.value)}
              placeholder="Ex: Avant modifications majeures"
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-bg text-primary-foreground">
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm restore dialog */}
      <Dialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restaurer la version {confirmRestore?.version_number} ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Les données actuelles seront remplacées par celles de cette version. Pensez à sauvegarder la version actuelle avant de restaurer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>Annuler</Button>
            <Button onClick={doRestore} className="gradient-bg text-primary-foreground">Restaurer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
