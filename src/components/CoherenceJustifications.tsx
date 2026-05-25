import { useState } from "react";
import { Sparkles, ExternalLink, Pencil, Check, X, Trash2, Plus, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeRefType } from "@/lib/strategicRefs";

export type JustifRef = {
  doc_type: "bp" | "bm";
  ref_type: string;
  ref_title?: string;
};

export type Justif = string | { text: string; ref?: JustifRef };

interface Props {
  items: Justif[];
  bpId?: string | null;
  bmId?: string | null;
  onClose?: () => void;
  onChange?: (items: Justif[]) => void;
  variant?: "card" | "panel";
}

function buildHref(ref: JustifRef, bpId?: string | null, bmId?: string | null): string | null {
  if (ref.doc_type === "bp" && bpId) {
    return `/business-plan/${bpId}?section=${encodeURIComponent(ref.ref_type)}`;
  }
  if (ref.doc_type === "bm" && bmId) {
    return `/business-model/${bmId}?block=${encodeURIComponent(ref.ref_type)}`;
  }
  return null;
}

function toObject(j: Justif): { text: string; ref?: JustifRef } {
  return typeof j === "string" ? { text: j } : { text: j.text, ref: j.ref };
}

export default function CoherenceJustifications({ items, bpId, bmId, onClose, onChange, variant = "panel" }: Props) {
  const editable = typeof onChange === "function";
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftRefTitle, setDraftRefTitle] = useState("");

  if ((!items || items.length === 0) && !editable) return null;

  const startEdit = (i: number) => {
    const obj = toObject(items[i]);
    setEditingIndex(i);
    setDraftText(obj.text);
    setDraftRefTitle(obj.ref?.ref_title || "");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraftText("");
    setDraftRefTitle("");
  };

  const saveEdit = () => {
    if (editingIndex === null || !onChange) return;
    const next = items.map((item, i) => {
      if (i !== editingIndex) return item;
      const obj = toObject(item);
      const newItem: Justif = {
        text: draftText.trim() || obj.text,
        ref: obj.ref
          ? { ...obj.ref, ref_title: draftRefTitle.trim() || obj.ref.ref_title }
          : undefined,
      };
      return newItem;
    });
    onChange(next);
    cancelEdit();
  };

  const removeItem = (i: number) => {
    if (!onChange) return;
    onChange(items.filter((_, idx) => idx !== i));
    if (editingIndex === i) cancelEdit();
  };

  const addItem = () => {
    if (!onChange) return;
    onChange([...items, { text: "Nouvelle justification" }]);
    setTimeout(() => startEdit(items.length), 0);
  };

  return (
    <div className={`glass-card rounded-${variant === "card" ? "xl p-5" : "2xl p-6"} mt-6 mb-6 border-l-4 border-primary`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Justifications de cohérence
        </h3>
        <div className="flex items-center gap-2">
          {editable && (
            <Button variant="ghost" size="sm" onClick={addItem} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" />
              Ajouter
            </Button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
              Masquer
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Éléments du Business Plan / Business Model qui ont guidé les choix.
        {editable ? " Vous pouvez corriger ou affiner chaque justification avant validation." : " Cliquez pour ouvrir l'élément source."}
      </p>
      <ul className="space-y-2 text-sm">
        {items.map((j, i) => {
          const obj = toObject(j);
          const { text, ref } = obj;
          const href = ref ? buildHref(ref, bpId, bmId) : null;
          const isEditing = editingIndex === i;

          if (isEditing) {
            return (
              <li key={i} className="flex gap-2 items-start p-2 rounded-lg bg-muted/30">
                <div className="flex-1 space-y-2">
                  <Input
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Texte de la justification"
                    className="h-8 text-sm"
                    autoFocus
                  />
                  {ref && (
                    <Input
                      value={draftRefTitle}
                      onChange={(e) => setDraftRefTitle(e.target.value)}
                      placeholder={`Titre de la référence (${ref.doc_type.toUpperCase()})`}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="p-1.5 rounded hover:bg-primary/10 text-primary" title="Enregistrer">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Annuler">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          }

          return (
            <li key={i} className="flex gap-2 group">
              <span className="text-primary mt-0.5">•</span>
              <span className="flex-1">
                {text}
                {ref && (
                  <>
                    {" "}
                    {href ? (
                      <Link
                        to={href}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        {ref.doc_type === "bp" ? "Voir BP" : "Voir BM"}
                        {ref.ref_title ? ` — ${ref.ref_title}` : ""}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">
                        ({ref.doc_type === "bp" ? "BP" : "BM"}
                        {ref.ref_title ? ` — ${ref.ref_title}` : ""})
                      </span>
                    )}
                  </>
                )}
              </span>
              {editable && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(i)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Modifier">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {editable && items.length === 0 && (
          <li className="text-xs text-muted-foreground italic py-2">
            Aucune justification. Cliquez sur « Ajouter » pour en créer une.
          </li>
        )}
      </ul>
    </div>
  );
}
