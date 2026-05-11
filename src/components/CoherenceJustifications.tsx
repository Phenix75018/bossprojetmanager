import { Sparkles, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

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

export default function CoherenceJustifications({ items, bpId, bmId, onClose, variant = "panel" }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`glass-card rounded-${variant === "card" ? "xl p-5" : "2xl p-6"} mt-6 mb-6 border-l-4 border-primary`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Justifications de cohérence
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Masquer
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Éléments du Business Plan / Business Model qui ont guidé les choix. Cliquez pour ouvrir l'élément source.
      </p>
      <ul className="space-y-2 text-sm">
        {items.map((j, i) => {
          const text = typeof j === "string" ? j : j.text;
          const ref = typeof j === "string" ? undefined : j.ref;
          const href = ref ? buildHref(ref, bpId, bmId) : null;
          return (
            <li key={i} className="flex gap-2">
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
