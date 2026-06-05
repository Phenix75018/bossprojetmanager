import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  LayoutGrid,
  DollarSign,
  FolderKanban,
  Loader2,
  Sparkles,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BP_SECTION_TYPES, BM_BLOCK_TYPES } from "@/lib/strategicRefs";

type Severity = "info" | "warn" | "error";
interface Alert {
  severity: Severity;
  title: string;
  description: string;
  href?: string;
  cta?: string;
}

interface ProjectRow {
  id: string;
  title: string;
}

interface Analysis {
  score: number;
  alerts: Alert[];
  stats: {
    bp: { exists: boolean; sections: number; missing: string[]; emptySections: number };
    bm: { exists: boolean; blocks: number; missing: string[]; emptyBlocks: number };
    budget: { exists: boolean; lines: number };
    plan: { phases: number; tasks: number; p0: number; orphanTasks: number };
  };
}

const HUMAN_LABELS: Record<string, string> = {
  executive_summary: "Résumé exécutif",
  market_analysis: "Analyse de marché",
  business_strategy: "Stratégie",
  financial_plan: "Plan financier",
  best_practices: "Bonnes pratiques",
  key_partners: "Partenaires clés",
  key_activities: "Activités clés",
  key_resources: "Ressources clés",
  value_propositions: "Propositions de valeur",
  customer_relationships: "Relations clients",
  channels: "Canaux",
  customer_segments: "Segments clients",
  cost_structure: "Structure de coûts",
  revenue_streams: "Sources de revenus",
  problem: "Problème",
  solution: "Solution",
  unique_value: "Valeur unique",
  unfair_advantage: "Avantage injuste",
  key_metrics: "Métriques clés",
};

const sevStyles: Record<Severity, string> = {
  info: "border-primary/30 bg-primary/5",
  warn: "border-amber-500/40 bg-amber-500/10",
  error: "border-destructive/40 bg-destructive/10",
};
const sevIcon: Record<Severity, JSX.Element> = {
  info: <CheckCircle2 className="w-4 h-4 text-primary" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  error: <XCircle className="w-4 h-4 text-destructive" />,
};

export default function CoherenceDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const rows = (data || []) as ProjectRow[];
      setProjects(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedId || !user) return;
    analyze(selectedId);
  }, [selectedId, user]);

  async function analyze(projectId: string) {
    setAnalyzing(true);
    setAnalysis(null);

    const [bpRes, bmRes, budgetRes, phasesRes, tasksRes] = await Promise.all([
      supabase.from("business_plans").select("id, updated_at").eq("project_id", projectId).maybeSingle(),
      supabase.from("business_models").select("id, updated_at").eq("project_id", projectId).maybeSingle(),
      supabase.from("budgets").select("id, updated_at").eq("project_id", projectId).maybeSingle(),
      supabase.from("phases").select("id").eq("project_id", projectId),
      supabase
        .from("tasks")
        .select("id, priority, duration_hours, dependencies, phase_id, updated_at, phases!inner(project_id)")
        .eq("phases.project_id", projectId),
    ]);

    const bp = bpRes.data;
    const bm = bmRes.data;
    const budget = budgetRes.data;

    let bpSections: { section_type: string; content: string; updated_at: string }[] = [];
    if (bp) {
      const { data } = await supabase
        .from("business_plan_sections")
        .select("section_type, content, updated_at")
        .eq("business_plan_id", bp.id);
      bpSections = data || [];
    }

    let bmBlocks: { block_type: string; content: string; updated_at: string }[] = [];
    if (bm) {
      const { data } = await supabase
        .from("business_model_blocks")
        .select("block_type, content, updated_at")
        .eq("business_model_id", bm.id);
      bmBlocks = data || [];
    }

    let budgetLines = 0;
    let budgetUpdatedAt: string | null = null;
    if (budget) {
      const { data } = await supabase
        .from("budget_lines")
        .select("id, updated_at")
        .eq("budget_id", budget.id);
      budgetLines = (data || []).length;
      budgetUpdatedAt = budget.updated_at;
    }

    const tasks = (tasksRes.data || []) as any[];
    const phases = (phasesRes.data || []) as any[];

    // ---- Compute alerts ----
    const alerts: Alert[] = [];

    // BP
    const bpTypesPresent = new Set(bpSections.map((s) => s.section_type));
    const bpMissing = BP_SECTION_TYPES.filter((t) => !bpTypesPresent.has(t));
    const bpEmpty = bpSections.filter((s) => (s.content || "").trim().length < 50).length;
    if (!bp) {
      alerts.push({
        severity: "error",
        title: "Aucun Business Plan",
        description: "Ce projet n'a pas encore de Business Plan rédigé.",
        href: "/business-plans",
        cta: "Créer un BP",
      });
    } else {
      if (bpMissing.length) {
        alerts.push({
          severity: "warn",
          title: `Sections BP manquantes (${bpMissing.length})`,
          description: bpMissing.map((m) => HUMAN_LABELS[m] || m).join(", "),
          href: `/business-plan/${bp.id}`,
          cta: "Compléter",
        });
      }
      if (bpEmpty > 0) {
        alerts.push({
          severity: "warn",
          title: `${bpEmpty} section(s) BP peu détaillée(s)`,
          description: "Certaines sections contiennent moins de 50 caractères.",
          href: `/business-plan/${bp.id}`,
          cta: "Enrichir",
        });
      }
    }

    // BM
    const bmTypesPresent = new Set(bmBlocks.map((b) => b.block_type));
    const bmCoreMissing = [
      "value_propositions",
      "customer_segments",
      "revenue_streams",
      "cost_structure",
    ].filter((t) => !bmTypesPresent.has(t));
    const bmEmpty = bmBlocks.filter((b) => (b.content || "").trim().length < 30).length;
    if (!bm) {
      alerts.push({
        severity: "error",
        title: "Aucun Business Model",
        description: "Ajoutez un BMC ou Lean Canvas pour cadrer le modèle.",
        href: "/business-models",
        cta: "Créer un BM",
      });
    } else if (bmCoreMissing.length) {
      alerts.push({
        severity: "warn",
        title: `Blocs BM essentiels manquants (${bmCoreMissing.length})`,
        description: bmCoreMissing.map((m) => HUMAN_LABELS[m] || m).join(", "),
        href: `/business-model/${bm.id}`,
        cta: "Compléter",
      });
    }

    // Budget
    if (!budget) {
      alerts.push({
        severity: "warn",
        title: "Aucun Budget prévisionnel",
        description: "Un budget aide à valider la cohérence financière du plan.",
        href: "/budgets",
        cta: "Créer un Budget",
      });
    } else if (budgetLines === 0) {
      alerts.push({
        severity: "warn",
        title: "Budget vide",
        description: "Le budget existe mais ne contient aucune ligne.",
        href: `/budget/${budget.id}`,
        cta: "Ajouter des lignes",
      });
    }

    // Plan d'action
    if (tasks.length === 0) {
      alerts.push({
        severity: "error",
        title: "Aucune tâche dans le plan d'action",
        description: "Générez ou ajoutez des tâches pour exécuter ce projet.",
        href: `/plan/${projectId}`,
        cta: "Voir le plan",
      });
    } else {
      const p0 = tasks.filter((t) => t.priority === "P0").length;
      const noDuration = tasks.filter((t) => !t.duration_hours || Number(t.duration_hours) === 0).length;
      if (p0 === 0) {
        alerts.push({
          severity: "warn",
          title: "Aucune tâche critique (P0)",
          description: "Identifiez au moins une priorité critique pour clarifier les jalons.",
          href: `/plan/${projectId}`,
          cta: "Ajuster",
        });
      }
      if (noDuration > 0) {
        alerts.push({
          severity: "warn",
          title: `${noDuration} tâche(s) sans durée estimée`,
          description: "Sans durée, le calendrier auto ne peut pas les planifier correctement.",
          href: `/plan/${projectId}`,
          cta: "Corriger",
        });
      }
    }

    // Freshness — BP/BM modifiés après budget/plan
    const planMostRecent =
      tasks.length > 0
        ? Math.max(...tasks.map((t) => new Date(t.updated_at).getTime()))
        : 0;
    const bpUpdated = bp ? new Date(bp.updated_at).getTime() : 0;
    const bmUpdated = bm ? new Date(bm.updated_at).getTime() : 0;
    const bgUpdated = budgetUpdatedAt ? new Date(budgetUpdatedAt).getTime() : 0;
    if (bp && bgUpdated && bpUpdated > bgUpdated + 60_000) {
      alerts.push({
        severity: "warn",
        title: "Budget potentiellement obsolète",
        description: "Le BP a été modifié après la dernière mise à jour du budget.",
        href: `/budget/${budget!.id}`,
        cta: "Régénérer",
      });
    }
    if (bp && planMostRecent && bpUpdated > planMostRecent + 60_000) {
      alerts.push({
        severity: "warn",
        title: "Plan d'action potentiellement obsolète",
        description: "Le BP a évolué après la dernière mise à jour du plan d'action.",
        href: `/plan/${projectId}`,
        cta: "Régénérer",
      });
    }

    // ---- Score ----
    let score = 100;
    for (const a of alerts) {
      if (a.severity === "error") score -= 20;
      else if (a.severity === "warn") score -= 8;
      else score -= 2;
    }
    score = Math.max(0, Math.min(100, score));

    if (alerts.length === 0) {
      alerts.push({
        severity: "info",
        title: "Cohérence stratégique optimale",
        description: "BP, BM, Budget et Plan sont alignés. Bravo !",
      });
    }

    setAnalysis({
      score,
      alerts,
      stats: {
        bp: { exists: !!bp, sections: bpSections.length, missing: bpMissing, emptySections: bpEmpty },
        bm: { exists: !!bm, blocks: bmBlocks.length, missing: bmCoreMissing, emptyBlocks: bmEmpty },
        budget: { exists: !!budget, lines: budgetLines },
        plan: {
          phases: phases.length,
          tasks: tasks.length,
          p0: tasks.filter((t) => t.priority === "P0").length,
          orphanTasks: 0,
        },
      },
    });
    setAnalyzing(false);
  }

  const scoreColor = useMemo(() => {
    if (!analysis) return "text-muted-foreground";
    if (analysis.score >= 80) return "text-emerald-500";
    if (analysis.score >= 50) return "text-amber-500";
    return "text-destructive";
  }, [analysis]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux projets
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-black">Cohérence stratégique</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Scannez l'alignement entre Business Plan, Business Model, Budget et Plan d'action.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Créez un premier projet pour activer l'analyse.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Projet à analyser
              </label>
              <select
                value={selectedId || ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full md:w-96 bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {analyzing || !analysis ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid lg:grid-cols-3 gap-5"
              >
                {/* Score */}
                <div className="lg:col-span-1 glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Score de cohérence
                  </p>
                  <div className={`text-7xl font-display font-black ${scoreColor}`}>
                    {analysis.score}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">/ 100</p>
                  <div className="w-full mt-6 grid grid-cols-2 gap-3 text-left">
                    <StatBox
                      icon={<FileText className="w-4 h-4" />}
                      label="BP"
                      value={analysis.stats.bp.exists ? `${analysis.stats.bp.sections} sect.` : "—"}
                    />
                    <StatBox
                      icon={<LayoutGrid className="w-4 h-4" />}
                      label="BM"
                      value={analysis.stats.bm.exists ? `${analysis.stats.bm.blocks} blocs` : "—"}
                    />
                    <StatBox
                      icon={<DollarSign className="w-4 h-4" />}
                      label="Budget"
                      value={analysis.stats.budget.exists ? `${analysis.stats.budget.lines} lignes` : "—"}
                    />
                    <StatBox
                      icon={<FolderKanban className="w-4 h-4" />}
                      label="Plan"
                      value={`${analysis.stats.plan.tasks} tâches`}
                    />
                  </div>
                </div>

                {/* Alerts */}
                <div className="lg:col-span-2 space-y-3">
                  <h2 className="font-display font-bold text-lg">
                    Alertes & recommandations ({analysis.alerts.length})
                  </h2>
                  {analysis.alerts.map((a, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`rounded-xl border p-4 ${sevStyles[a.severity]}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{sevIcon[a.severity]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{a.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {a.description}
                          </div>
                          {a.href && (
                            <Link
                              to={a.href}
                              className="inline-block mt-2 text-xs font-semibold text-primary hover:underline"
                            >
                              {a.cta || "Ouvrir"} →
                            </Link>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <div className="font-semibold text-sm mt-0.5">{value}</div>
    </div>
  );
}
