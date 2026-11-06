import { AlertTriangle, Info, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { StudyAudit, AuditCategory } from "@/lib/marketStudyAudit";

const LABELS: Record<AuditCategory, string> = {
  secteur: "Cohérence secteur", methodes: "Méthodes choisies", sections: "Sections écrites", sources: "Sources", estimations: "Estimations",
};

export default function MarketStudyAuditPanel({ audit, onOpen }: { audit: StudyAudit; onOpen: (key: string) => void }) {
  const tone = audit.score >= 80 ? "text-primary" : audit.score >= 50 ? "text-accent-foreground" : "text-destructive";
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 flex flex-col sm:flex-row gap-6 items-center">
        <div className="text-center">
          <div className={`text-5xl font-display ${tone}`}>{audit.score}</div>
          <div className="text-sm text-muted-foreground">Score / 100</div>
        </div>
        <div className="flex-1 w-full grid gap-3">
          {(Object.keys(LABELS) as AuditCategory[]).map((c) => (
            <div key={c}>
              <div className="flex justify-between text-sm"><span>{LABELS[c]}</span><span>{audit.categoryScores[c]}</span></div>
              <Progress value={audit.categoryScores[c]} />
            </div>
          ))}
        </div>
      </div>
      {audit.issues.length === 0 ? (
        <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" /> Aucune incohérence détectée.</p>
      ) : (
        <ul className="space-y-2">
          {audit.issues.map((i, n) => {
            const Icon = i.severity === "critical" ? XCircle : i.severity === "warning" ? AlertTriangle : Info;
            return (
              <li key={n} className="rounded-md border bg-card p-3 flex gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${i.severity === "critical" ? "text-destructive" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="text-xs uppercase text-muted-foreground">{LABELS[i.category]}</div>
                  <p className="text-sm font-medium">{i.message}</p>
                  <p className="text-sm text-muted-foreground">{i.recommendation}</p>
                </div>
                {i.sectionKey && <Button size="sm" variant="outline" onClick={() => onOpen(i.sectionKey!)}>Voir</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
