import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  GitBranch,
  Info,
  Loader2,
  RefreshCw,
  ScanSearch,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  runConsistencyChecks,
  type CheckCategory,
  type CheckResult,
  type CheckSeverity,
} from "@/lib/consistencyChecks";

const CATEGORIES: { key: CheckCategory; label: string; icon: typeof CalendarClock }[] = [
  { key: "dates", label: "Dates & planning", icon: CalendarClock },
  { key: "dependencies", label: "Dépendances", icon: GitBranch },
  { key: "budget", label: "Budget", icon: DollarSign },
];

const sevStyles: Record<CheckSeverity, string> = {
  error: "border-destructive/40 bg-destructive/5",
  warn: "border-amber-500/40 bg-amber-500/5",
  info: "border-primary/30 bg-primary/5",
};
const sevIcon: Record<CheckSeverity, JSX.Element> = {
  error: <XCircle className="w-4 h-4 text-destructive shrink-0" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info: <Info className="w-4 h-4 text-primary shrink-0" />,
};
const sevLabel: Record<CheckSeverity, string> = { error: "Bloquant", warn: "À surveiller", info: "Suggestion" };

function scoreTone(score: number) {
  if (score >= 85) return { text: "text-teal-500", ring: "stroke-teal-500", label: "Cohérent" };
  if (score >= 60) return { text: "text-amber-500", ring: "stroke-amber-500", label: "À consolider" };
  return { text: "text-destructive", ring: "stroke-destructive", label: "Incohérences majeures" };
}

function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
        <circle cx="55" cy="55" r={r} className="stroke-border" strokeWidth="8" fill="none" />
        <motion.circle
          cx="55"
          cy="55"
          r={r}
          className={tone.ring}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(score / 100) * c} ${c}` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-3xl ${tone.text}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function ChecksPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [filter, setFilter] = useState<CheckCategory | "all">("all");
  const [ranAt, setRanAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const rows = data || [];
      setProjects(rows);
      if (rows.length) setSelectedId((prev) => prev || rows[0].id);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (selectedId) run(selectedId);
  }, [selectedId]);

  async function run(projectId: string) {
    setRunning(true);
    setResult(null);
    try {
      const [projectRes, phasesRes, tasksRes, eventsRes, budgetRes, bpRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("phases").select("id, name, sort_order").eq("project_id", projectId).order("sort_order"),
        supabase
          .from("tasks")
          .select("id, phase_id, title, status, priority, duration_hours, dependencies, phases!inner(project_id)")
          .eq("phases.project_id", projectId),
        supabase
          .from("calendar_events")
          .select("id, title, start_time, end_time, task_id")
          .eq("project_id", projectId)
          .order("start_time"),
        supabase.from("budgets").select("id, horizon_months, updated_at").eq("project_id", projectId).maybeSingle(),
        supabase.from("business_plans").select("updated_at").eq("project_id", projectId).maybeSingle(),
      ]);

      if (!projectRes.data) throw new Error("Projet introuvable");

      let budget: any = null;
      if (budgetRes.data) {
        const { data: lines } = await supabase
          .from("budget_lines")
          .select("category, label, monthly_values, is_total")
          .eq("budget_id", budgetRes.data.id);
        budget = {
          ...budgetRes.data,
          lines: (lines || []).map((l: any) => ({ ...l, monthly_values: l.monthly_values ?? [] })),
        };
      }

      setResult(
        runConsistencyChecks({
          project: projectRes.data as any,
          phases: (phasesRes.data || []) as any,
          tasks: (tasksRes.data || []) as any,
          events: (eventsRes.data || []) as any,
          budget,
          bpUpdatedAt: bpRes.data?.updated_at ?? null,
        }),
      );
      setRanAt(new Date());
    } catch (e: any) {
      toast.error(e.message || "Échec des vérifications");
    } finally {
      setRunning(false);
    }
  }

  const visible = useMemo(
    () => (result ? result.findings.filter((f) => filter === "all" || f.category === filter) : []),
    [result, filter],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container pt-24 pb-16">
        <div className="flex items-start gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center shrink-0">
            <ScanSearch className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Mode vérifications</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Audit automatique des incohérences de dates, de dépendances et de budget, avec un score de cohérence et des
              recommandations actionnables.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 mb-8 border border-border/50">
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projet</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loading || projects.length === 0}
                className="mt-1.5 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              >
                {projects.length === 0 && <option value="">Aucun projet</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => selectedId && run(selectedId)}
              disabled={running || !selectedId}
              className="gradient-bg text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {running ? "Analyse…" : "Relancer les vérifications"}
            </button>
          </div>
        </div>

        {running && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyse des dates, dépendances et budget…
          </div>
        )}

        {!running && result && (
          <div className="space-y-8">
            {/* Score */}
            <section className="glass-card rounded-2xl p-6 border border-border/50 flex flex-col md:flex-row gap-6 items-center">
              <ScoreRing score={result.score} />
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-2xl">Score de cohérence</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-muted ${scoreTone(result.score).text}`}>
                    {scoreTone(result.score).label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.counts.error} bloquant(s) · {result.counts.warn} à surveiller · {result.counts.info} suggestion(s)
                  {ranAt && ` — analysé à ${ranAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">
                  {CATEGORIES.map((c) => {
                    const s = result.byCategory[c.key];
                    return (
                      <button
                        key={c.key}
                        onClick={() => setFilter(filter === c.key ? "all" : c.key)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          filter === c.key ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <c.icon className="w-4 h-4 text-primary" />
                          {c.label}
                        </div>
                        <div className={`font-display text-xl mt-1 ${scoreTone(s.score).text}`}>{s.score}/100</div>
                        <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.score >= 85 ? "bg-teal-500" : s.score >= 60 ? "bg-amber-500" : "bg-destructive"
                            }`}
                            style={{ width: `${s.score}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {s.error + s.warn + s.info === 0
                            ? "Aucune anomalie"
                            : `${s.error} bloquant · ${s.warn} alerte · ${s.info} info`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Key figures */}
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Charge restante", value: `${result.summary.openHours} h` },
                {
                  label: "Temps disponible",
                  value: result.summary.availableHours === null ? "—" : `${result.summary.availableHours} h`,
                },
                {
                  label: "Jours avant échéance",
                  value: result.summary.daysToDeadline === null ? "—" : `${result.summary.daysToDeadline} j`,
                },
                {
                  label: "Trésorerie la plus basse",
                  value:
                    result.summary.cashLow === null
                      ? "—"
                      : `${result.summary.cashLow.toLocaleString("fr-FR")} €`,
                },
              ].map((m) => (
                <div key={m.label} className="glass-card rounded-xl p-4 border border-border/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
                  <p className="font-display text-2xl mt-1">{m.value}</p>
                </div>
              ))}
            </section>

            {/* Findings */}
            <section>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-display text-2xl">Incohérences détectées</h2>
                <div className="flex gap-1.5">
                  {(["all", ...CATEGORIES.map((c) => c.key)] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setFilter(k as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        filter === k
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k === "all" ? "Tout" : CATEGORIES.find((c) => c.key === k)!.label}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 border border-teal-500/30 bg-teal-500/5 text-center">
                  <CheckCircle2 className="w-8 h-8 text-teal-500 mx-auto mb-2" />
                  <p className="font-display text-xl">Aucune incohérence sur ce périmètre</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dates, dépendances et budget sont alignés selon les règles de vérification.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((f, i) => {
                    const fix = getQuickFix(f);
                    return (
                      <motion.article
                        key={f.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`rounded-xl border p-4 ${sevStyles[f.severity]}`}
                      >
                        <div className="flex items-start gap-3">
                          {sevIcon[f.severity]}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{f.title}</h3>
                              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-background/70 border border-border/60">
                                {sevLabel[f.severity]}
                              </span>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {CATEGORIES.find((c) => c.key === f.category)?.label}
                              </span>
                              {fix && (
                                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/30">
                                  Correction auto
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{f.detail}</p>
                            <p className="text-sm mt-2">
                              <span className="font-semibold text-primary">Recommandation : </span>
                              {f.recommendation}
                            </p>
                            {fix && (
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => applyFix(f.id, fix)}
                                  disabled={!!fixing}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                  {fixing === f.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Wand2 className="w-3.5 h-3.5" />
                                  )}
                                  {fixing === f.id ? "Correction…" : fix.label}
                                </button>
                                <span className="text-[11px] text-muted-foreground">{fix.description}</span>
                              </div>
                            )}
                          </div>
                          {f.href && (
                            <Link
                              to={f.href}
                              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                            >
                              {f.cta || "Ouvrir"}
                            </Link>
                          )}
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {!running && !result && !loading && projects.length === 0 && (
          <p className="text-muted-foreground text-sm">Créez d'abord un projet pour lancer les vérifications.</p>
        )}
      </main>
    </div>
  );
}
