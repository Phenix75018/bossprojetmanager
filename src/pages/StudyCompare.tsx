import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DEFAULT_CONFIG, orderedSections, type MarketStudyConfig, type MarketStudySection } from "@/lib/marketStudy";
import { auditMarketStudy } from "@/lib/marketStudyAudit";

interface Row { id: string; title: string; config: MarketStudyConfig; sections: MarketStudySection[] }

export default function StudyCompare() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sort, setSort] = useState<"score" | "title">("score");

  useEffect(() => {
    supabase.from("market_studies").select("id,title,config,sections").order("created_at", { ascending: false })
      .then(({ data }) => setRows(((data ?? []) as any[]).map((d) => ({ id: d.id, title: d.title, config: { ...DEFAULT_CONFIG, ...(d.config ?? {}) }, sections: d.sections ?? [] }))));
  }, []);

  const items = useMemo(() => (rows ?? []).map((r) => {
    const wanted = orderedSections(r.config.sections);
    const written = wanted.filter((w) => r.sections.some((s) => s.key === w.key && s.content?.trim())).length;
    return { ...r, wanted: wanted.length, written, audit: auditMarketStudy(r.config, r.sections) };
  }).sort((a, b) => sort === "score" ? b.audit.score - a.audit.score : a.title.localeCompare(b.title)), [rows, sort]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <Link to="/market-studies" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Études de marché</Link>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h1 className="text-3xl font-display">Comparer les études</h1>
          <div className="flex gap-2">
            <Button size="sm" variant={sort === "score" ? "default" : "outline"} onClick={() => setSort("score")}>Trier par score</Button>
            <Button size="sm" variant={sort === "title" ? "default" : "outline"} onClick={() => setSort("title")}>Trier par nom</Button>
          </div>
        </div>
        {!rows ? <Loader2 className="animate-spin" /> : items.length === 0 ? (
          <p className="text-muted-foreground">Aucune étude. <Link to="/market-studies" className="underline">Lancer une étude</Link></p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="p-3">Étude</th><th className="p-3">Secteur</th><th className="p-3">Méthodes</th><th className="p-3">Sections écrites</th><th className="p-3">Score</th><th className="p-3">Problèmes</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 align-top">
                    <td className="p-3 font-medium">{s.title}</td>
                    <td className="p-3">{s.config.sector || <span className="text-destructive">Non renseigné</span>}<div className="text-xs text-muted-foreground">{s.config.geography}</div></td>
                    <td className="p-3"><div className="flex flex-wrap gap-1">{s.config.frameworks.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</div></td>
                    <td className="p-3 min-w-32">{s.written} / {s.wanted}<Progress value={s.wanted ? (s.written / s.wanted) * 100 : 0} className="mt-1" /></td>
                    <td className="p-3 text-2xl font-display">{s.audit.score}</td>
                    <td className="p-3 text-xs">
                      {s.audit.issues.filter((i) => i.severity === "critical").length} grave(s)<br />
                      {s.audit.issues.filter((i) => i.severity === "warning").length} moyen(s)
                    </td>
                    <td className="p-3"><Button asChild size="sm" variant="outline"><Link to={`/market-study/${s.id}?tab=audit`}><ShieldCheck className="w-4 h-4" /> Vérification</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
