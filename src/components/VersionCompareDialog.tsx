import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentVersion } from "@/hooks/useDocumentVersions";

interface VersionCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DocumentVersion[];
  documentType: "business_plan" | "business_model" | "budget";
}

// Deep diff: returns a flat list of { path, left, right } for changed values
function diffObjects(a: any, b: any, path = ""): { path: string; left: string; right: string }[] {
  const diffs: { path: string; left: string; right: string }[] = [];
  const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    const va = a?.[key];
    const vb = b?.[key];
    if (Array.isArray(va) && Array.isArray(vb)) {
      const maxLen = Math.max(va.length, vb.length);
      for (let i = 0; i < maxLen; i++) {
        if (typeof va[i] === "object" && typeof vb[i] === "object") {
          diffs.push(...diffObjects(va[i], vb[i], `${fullPath}[${i}]`));
        } else if (JSON.stringify(va[i]) !== JSON.stringify(vb[i])) {
          diffs.push({ path: `${fullPath}[${i}]`, left: formatVal(va?.[i]), right: formatVal(vb?.[i]) });
        }
      }
    } else if (typeof va === "object" && va !== null && typeof vb === "object" && vb !== null && !Array.isArray(va)) {
      diffs.push(...diffObjects(va, vb, fullPath));
    } else if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffs.push({ path: fullPath, left: formatVal(va), right: formatVal(vb) });
    }
  }
  return diffs;
}

function formatVal(v: any): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 200) + "…" : v;
  return JSON.stringify(v);
}

// Friendly label map for known keys
const LABEL_MAP: Record<string, string> = {
  title: "Titre",
  content: "Contenu",
  label: "Libellé",
  section_type: "Type de section",
  block_type: "Type de bloc",
  sort_order: "Ordre",
  category: "Catégorie",
  subcategory: "Sous-catégorie",
  monthly_values: "Valeurs mensuelles",
  is_total: "Ligne de total",
  description: "Description",
  status: "Statut",
  framework: "Framework",
};

function friendlyPath(path: string, docType: string): string {
  // e.g. "sections[0].content" → "Section 1 — Contenu"
  const parts = path.split(".");
  let result = "";
  for (const part of parts) {
    const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      const name = arrMatch[1];
      const idx = parseInt(arrMatch[2]) + 1;
      const prefix = name === "sections" ? "Section" : name === "blocks" ? "Bloc" : name === "lines" ? "Ligne" : name;
      result += `${prefix} ${idx} → `;
    } else {
      result += (LABEL_MAP[part] || part) + " → ";
    }
  }
  return result.replace(/ → $/, "");
}

// Render content diff with line-by-line highlighting for long text
function ContentDiff({ left, right }: { left: string; right: string }) {
  if (left.length < 80 && right.length < 80) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-destructive/10 rounded px-2 py-1 text-xs break-words">{left}</div>
        <div className="bg-emerald-500/10 rounded px-2 py-1 text-xs break-words">{right}</div>
      </div>
    );
  }
  // Line-by-line diff for longer content
  const lLines = left.split("\n");
  const rLines = right.split("\n");
  const maxLines = Math.max(lLines.length, rLines.length);
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {Array.from({ length: Math.min(maxLines, 30) }, (_, i) => {
        const l = lLines[i] || "";
        const r = rLines[i] || "";
        const changed = l !== r;
        return (
          <div key={i} className="contents">
            <div className={`px-1.5 py-0.5 rounded break-words ${changed ? "bg-destructive/10" : ""}`}>{l || "—"}</div>
            <div className={`px-1.5 py-0.5 rounded break-words ${changed ? "bg-emerald-500/10" : ""}`}>{r || "—"}</div>
          </div>
        );
      })}
      {maxLines > 30 && (
        <div className="col-span-2 text-center text-muted-foreground py-1">… et {maxLines - 30} lignes supplémentaires</div>
      )}
    </div>
  );
}

export default function VersionCompareDialog({ open, onOpenChange, versions, documentType }: VersionCompareDialogProps) {
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  const leftVersion = versions.find(v => v.id === leftId);
  const rightVersion = versions.find(v => v.id === rightId);

  const diffs = useMemo(() => {
    if (!leftVersion || !rightVersion) return [];
    // Compare the relevant data arrays
    const key = documentType === "business_plan" ? "sections" : documentType === "business_model" ? "blocks" : "lines";
    const leftData = { [key]: (leftVersion.snapshot as any)?.[key] || [] };
    const rightData = { [key]: (rightVersion.snapshot as any)?.[key] || [] };
    return diffObjects(leftData, rightData);
  }, [leftVersion, rightVersion, documentType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comparer deux versions</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Version A (ancienne)</p>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id} disabled={v.id === rightId}>
                    v{v.version_number} — {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Version B (nouvelle)</p>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id} disabled={v.id === leftId}>
                    v{v.version_number} — {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!leftId || !rightId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-12">
            Sélectionnez deux versions à comparer
          </div>
        ) : diffs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm py-12">
            <div className="text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="font-medium">Versions identiques</p>
              <p className="text-muted-foreground text-xs">Aucune différence trouvée</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[55vh]">
            <div className="space-y-3 pr-4">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <span>Champ modifié</span>
                <span className="text-destructive">v{leftVersion?.version_number} (avant)</span>
                <span className="text-emerald-600">v{rightVersion?.version_number} (après)</span>
              </div>

              {diffs.map((d, i) => {
                const isContent = d.path.includes("content") || d.path.includes("monthly_values");
                return (
                  <div key={i} className="border-b border-border/30 pb-3">
                    <p className="text-xs font-semibold text-foreground mb-1.5">
                      {friendlyPath(d.path, documentType)}
                    </p>
                    {isContent ? (
                      <ContentDiff left={d.left} right={d.right} />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-destructive/10 rounded px-2 py-1 text-xs break-words font-mono">{d.left}</div>
                        <div className="bg-emerald-500/10 rounded px-2 py-1 text-xs break-words font-mono">{d.right}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-2 border-t text-xs text-muted-foreground">
          <span>{diffs.length} différence{diffs.length > 1 ? "s" : ""} trouvée{diffs.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/20" /> Supprimé</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20" /> Ajouté</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
