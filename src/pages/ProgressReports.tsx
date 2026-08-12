import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileBarChart,
  Sparkles,
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProgressReportCharts from "@/components/ProgressReportCharts";
import { exportProgressReportPDF, euro, type ProgressReportPayload } from "@/lib/progressReportPdf";

type Period = "week" | "month" | "quarter";

const PERIODS: { value: Period; label: string; hint: string }[] = [
  { value: "week", label: "Hebdomadaire", hint: "7 derniers jours" },
  { value: "month", label: "Mensuel", hint: "30 derniers jours" },
  { value: "quarter", label: "Trimestriel", hint: "90 derniers jours" },
];

const sevBadge = (tag?: string) => {
  const t = (tag || "").toLowerCase();
  if (t === "high" || t === "élevé" || t === "p0") return "bg-destructive/15 text-destructive border-destructive/30";
  if (t === "medium" || t === "moyen" || t === "p1") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-primary/10 text-primary border-primary/30";
};

export default function ProgressReports() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; title: string; completion_percent: number }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<ProgressReportPayload | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows, error } = await supabase
        .from("projects")
        .select("id, title, completion_percent")
        .order("updated_at", { ascending: false });
      if (error) toast.error("Impossible de charger les projets");
      setProjects(rows ?? []);
      setSelectedId((prev) => prev ?? rows?.[0]?.id ?? null);
      setLoading(false);
    })();
  }, [user]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const generate = async () => {
    if (!selectedId) {
      toast.error("Sélectionnez un projet");
      return;
    }
    setGenerating(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("generate-progress-report", {
        body: { projectId: selectedId, period },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as ProgressReportPayload);
      toast.success("Rapport d'avancement généré");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container pt-24 pb-16">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux projets
        </Link>

        <div className="flex items-start gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center shrink-0">
            <FileBarChart className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Rapport d'avancement IA</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Synthèse automatique de l'avancement des tâches, des écarts budgétaires, des risques et des prochaines
              étapes — exportable en PDF pour vos investisseurs et partenaires.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-card rounded-2xl p-5 mb-8 border border-border/50">
          <div className="grid md:grid-cols-[1fr_auto_auto] gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projet</label>
              <select
                value={selectedId ?? ""}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setData(null);
                }}
                disabled={loading || projects.length === 0}
                className="mt-1.5 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              >
                {projects.length === 0 && <option value="">Aucun projet</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.completion_percent}%
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Périodicité</label>
              <div className="mt-1.5 flex gap-1.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    title={p.hint}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      period === p.value
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={generating || !selectedId}
                className="gradient-bg text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Génération…" : "Générer le rapport"}
              </button>
              {data && (
                <button
                  onClick={() => exportProgressReportPDF(data)}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-border hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {generating && (
          <div className="glass-card rounded-2xl p-10 text-center border border-border/50">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-3">
              Analyse du plan d'action, du budget et du calendrier de « {selectedProject?.title} »…
            </p>
          </div>
        )}

        {!generating && !data && (
          <div className="glass-card rounded-2xl p-10 text-center border border-border/50">
            <FileBarChart className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground mt-3">
              Sélectionnez un projet et une périodicité, puis lancez la génération.
            </p>
          </div>
        )}

        {data && !generating && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* KPIs */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Avancement des tâches",
                  value:
                    data.stats.tasks > 0
                      ? `${Math.round((data.stats.done / data.stats.tasks) * 100)} %`
                      : `${data.project.completion_percent} %`,
                  hint: `${data.stats.done}/${data.stats.tasks} terminées`,
                },
                { label: "Terminé sur la période", value: `${data.stats.doneRecent}`, hint: `${data.stats.inProgress} en cours` },
                { label: "Charge réalisée", value: `${data.stats.doneHours} h`, hint: `sur ${data.stats.totalHours} h` },
                { label: "P0 ouvertes", value: `${data.stats.p0Open}`, hint: "tâches critiques" },
              ].map((k) => (
                <div key={k.label} className="glass-card rounded-xl p-4 border border-border/50">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-display text-primary mt-1">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.hint}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <ProgressReportCharts charts={data.charts} />



            {/* Executive summary */}
            <section className="glass-card rounded-2xl p-6 border border-border/50">
              <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Synthèse exécutive
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {data.report.executive_summary || "Non disponible."}
              </p>
              {!!data.report.highlights?.length && (
                <ul className="mt-4 space-y-1.5">
                  {data.report.highlights.map((h, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {h}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Progress + budget */}
            <div className="grid lg:grid-cols-2 gap-6">
              <section className="glass-card rounded-2xl p-6 border border-border/50">
                <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Avancement
                </h2>
                <p className="text-sm leading-relaxed whitespace-pre-line">{data.report.progress?.narrative || "—"}</p>
                <div className="grid sm:grid-cols-2 gap-2 mt-4">
                  {(data.report.progress?.metrics ?? []).map((m, i) => (
                    <div key={i} className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-base font-semibold text-primary">{m.value}</p>
                      {m.comment && <p className="text-xs text-muted-foreground">{m.comment}</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-card rounded-2xl p-6 border border-border/50">
                <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" /> Budget
                </h2>
                {data.budget ? (
                  <div className="grid sm:grid-cols-2 gap-2 mb-4">
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Revenus cumulés</p>
                      <p className="text-base font-semibold text-primary">{euro(data.budget.revenue)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">EBITDA prévisionnel</p>
                      <p className="text-base font-semibold text-primary">{euro(data.budget.ebitda)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Marge brute</p>
                      <p className="text-base font-semibold text-primary">{euro(data.budget.grossMargin)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Charges fixes</p>
                      <p className="text-base font-semibold text-primary">{euro(data.budget.fixed)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-3">Aucun budget prévisionnel rattaché à ce projet.</p>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-line">{data.report.budget?.narrative || "—"}</p>
              </section>
            </div>

            {/* Risks */}
            {!!data.report.risks?.length && (
              <section className="glass-card rounded-2xl p-6 border border-border/50">
                <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Risques
                </h2>
                <div className="space-y-3">
                  {data.report.risks.map((r, i) => (
                    <div key={i} className="rounded-xl border border-border/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-sm">{r.title}</p>
                        {r.severity && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sevBadge(r.severity)}`}>
                            {r.severity}
                          </span>
                        )}
                      </div>
                      {r.impact && <p className="text-xs text-muted-foreground mt-1.5">Impact : {r.impact}</p>}
                      {r.mitigation && <p className="text-xs text-muted-foreground mt-1">Mitigation : {r.mitigation}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations + next steps */}
            <div className="grid lg:grid-cols-2 gap-6">
              {!!data.report.recommendations?.length && (
                <section className="glass-card rounded-2xl p-6 border border-border/50">
                  <h2 className="font-display text-xl mb-4">Recommandations</h2>
                  <div className="space-y-3">
                    {data.report.recommendations.map((r, i) => (
                      <div key={i} className="rounded-xl border border-border/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-sm">{r.title}</p>
                          {r.priority && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sevBadge(r.priority)}`}>
                              {r.priority}
                            </span>
                          )}
                        </div>
                        {r.detail && <p className="text-xs text-muted-foreground mt-1.5">{r.detail}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {!!data.report.next_steps?.length && (
                <section className="glass-card rounded-2xl p-6 border border-border/50">
                  <h2 className="font-display text-xl mb-4">Prochaines étapes</h2>
                  <div className="space-y-3">
                    {data.report.next_steps.map((s, i) => (
                      <div key={i} className="rounded-xl border border-border/50 p-4">
                        <p className="font-semibold text-sm">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {[s.deadline && `Échéance : ${s.deadline}`, s.owner && `Responsable : ${s.owner}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Généré le {new Date(data.generated_at).toLocaleString("fr-FR")} · moteur {data.engine}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
