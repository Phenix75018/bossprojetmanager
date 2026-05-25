import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Clock,
  RefreshCw,
  Users,
  AlertTriangle,
  Shield,
  Star,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useProjectsDB } from "@/hooks/useProjectsDB";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CoherenceJustifications, { Justif } from "@/components/CoherenceJustifications";

interface SubtaskDraft {
  title: string;
  duration_hours: number;
}

interface TaskDraft {
  title: string;
  description: string;
  priority: string;
  duration_hours: number;
  subtasks: SubtaskDraft[];
}

interface PhaseDraft {
  name: string;
  tasks: TaskDraft[];
}

interface TeamRecommendation {
  role: string;
  description: string;
  importance: "nécessaire" | "fortement recommandé" | "recommandé";
  skills: string[];
  estimated_monthly_cost: string;
}

interface PlanDraft {
  title: string;
  phases: PhaseDraft[];
  team_recommendations?: TeamRecommendation[];
  coherence_justifications?: Justif[];
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  P0: { label: "Critique", class: "priority-critical" },
  P1: { label: "Haute", class: "priority-high" },
  P2: { label: "Normale", class: "priority-low" },
};

export default function ValidatePlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const { createProjectFromAI } = useProjectsDB();

  const { plan: initialPlan, description, projectType, status, availability } = (location.state || {}) as {
    plan: PlanDraft;
    description: string;
    projectType: string;
    status: string;
    availability: any;
  };

  const [plan, setPlan] = useState<PlanDraft>(initialPlan || { title: "", phases: [] });
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(
    new Set(initialPlan?.phases?.map((_, i) => i) || [])
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [bpId, setBpId] = useState<string | null>(null);
  const [bmId, setBmId] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-plan", {
        body: { description, projectType, status, availability },
      });
      if (fnError) throw fnError;
      if (!fnData?.plan) throw new Error("Plan non généré");
      setPlan(fnData.plan);
      setExpandedPhases(new Set(fnData.plan.phases.map((_: any, i: number) => i)));
      if (fnData.bp_id) setBpId(fnData.bp_id);
      if (fnData.bm_id) setBmId(fnData.bm_id);
      toast.success("Nouveau plan généré !");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la régénération");
    } finally {
      setRegenerating(false);
    }
  };

  if (!initialPlan) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-28 text-center">
          <h1 className="text-2xl font-bold mb-4">Aucun plan à valider</h1>
          <button onClick={() => navigate("/onboarding")} className="text-primary hover:underline">
            Créer un projet
          </button>
        </div>
      </div>
    );
  }

  const togglePhase = (i: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const updatePhase = (pi: number, updates: Partial<PhaseDraft>) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) => (i === pi ? { ...p, ...updates } : p)),
    }));
  };

  const updateTask = (pi: number, ti: number, updates: Partial<TaskDraft>) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === pi
          ? { ...p, tasks: p.tasks.map((t, j) => (j === ti ? { ...t, ...updates } : t)) }
          : p
      ),
    }));
  };

  const deleteTask = (pi: number, ti: number) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === pi ? { ...p, tasks: p.tasks.filter((_, j) => j !== ti) } : p
      ),
    }));
  };

  const addTask = (pi: number) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === pi
          ? {
              ...p,
              tasks: [
                ...p.tasks,
                { title: "Nouvelle tâche", description: "", priority: "P1", duration_hours: 4, subtasks: [] },
              ],
            }
          : p
      ),
    }));
  };

  const deletePhase = (pi: number) => {
    setPlan((prev) => ({ ...prev, phases: prev.phases.filter((_, i) => i !== pi) }));
  };

  const updateSubtask = (pi: number, ti: number, si: number, updates: Partial<SubtaskDraft>) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === pi
          ? {
              ...p,
              tasks: p.tasks.map((t, j) =>
                j === ti
                  ? { ...t, subtasks: t.subtasks.map((st, k) => (k === si ? { ...st, ...updates } : st)) }
                  : t
              ),
            }
          : p
      ),
    }));
  };

  const deleteSubtask = (pi: number, ti: number, si: number) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === pi
          ? {
              ...p,
              tasks: p.tasks.map((t, j) =>
                j === ti ? { ...t, subtasks: t.subtasks.filter((_, k) => k !== si) } : t
              ),
            }
          : p
      ),
    }));
  };

  const addSubtask = (pi: number, ti: number) => {
    setPlan((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === pi
          ? {
              ...p,
              tasks: p.tasks.map((t, j) =>
                j === ti
                  ? { ...t, subtasks: [...t.subtasks, { title: "Nouvelle sous-tâche", duration_hours: 1 }] }
                  : t
              ),
            }
          : p
      ),
    }));
  };

  const cyclePriority = (pi: number, ti: number) => {
    const order = ["P0", "P1", "P2"];
    const current = plan.phases[pi].tasks[ti].priority;
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateTask(pi, ti, { priority: next });
  };

  const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const totalHours = plan.phases.reduce(
    (sum, p) => sum + p.tasks.reduce((s, t) => s + t.duration_hours, 0),
    0
  );

  const handleValidate = async () => {
    setSaving(true);
    try {
      const projectId = await createProjectFromAI(plan, description, status, availability);
      if (projectId) {
        // Save project_type
        await supabase.from("projects").update({ project_type: projectType || "personal" }).eq("id", projectId);

        // Save team recommendations to DB
        if (plan.team_recommendations && plan.team_recommendations.length > 0) {
          const recsToInsert = plan.team_recommendations.map((rec, i) => ({
            project_id: projectId,
            role: rec.role,
            description: rec.description,
            importance: rec.importance,
            skills: rec.skills,
            estimated_monthly_cost: rec.estimated_monthly_cost || null,
            sort_order: i,
          }));
          await supabase.from("team_recommendations").insert(recsToInsert);
        }

        toast.success("Plan d'action validé et sauvegardé !");
        navigate(`/plan/${projectId}`);
      } else {
        throw new Error("Erreur lors de la sauvegarde");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/onboarding")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Modifier le projet
          </button>

          <div className="flex items-center gap-3 mb-1">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-black">Révision du plan d'action</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Modifiez, réorganisez ou supprimez des éléments avant de valider.
          </p>
        </div>

        {/* Plan title */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Titre du projet
              </label>
              {editingTitle ? (
                <input
                  autoFocus
                  value={plan.title}
                  onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                  className="w-full text-xl font-display font-bold bg-transparent border-b-2 border-primary focus:outline-none mt-1"
                />
              ) : (
                <h2
                  className="text-xl font-display font-bold mt-1 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {plan.title} <Pencil className="w-4 h-4 inline text-muted-foreground" />
                </h2>
              )}
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-2xl font-mono font-bold text-primary">{plan.phases.length}</div>
                <div className="text-xs text-muted-foreground">Phases</div>
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-primary">{totalTasks}</div>
                <div className="text-xs text-muted-foreground">Tâches</div>
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-primary">{totalHours}h</div>
                <div className="text-xs text-muted-foreground">Estimé</div>
              </div>
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-4 mb-8">
          {plan.phases.map((phase, pi) => {
            const isExpanded = expandedPhases.has(pi);
            const phaseHours = phase.tasks.reduce((s, t) => s + t.duration_hours, 0);

            return (
              <motion.div
                key={pi}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pi * 0.05 }}
                className="glass-card rounded-2xl overflow-hidden"
              >
                {/* Phase header */}
                <div className="flex items-center gap-3 p-5">
                  <button onClick={() => togglePhase(pi)} className="text-muted-foreground">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <input
                    value={phase.name}
                    onChange={(e) => updatePhase(pi, { name: e.target.value })}
                    className="flex-1 font-display font-bold bg-transparent focus:outline-none focus:border-b-2 focus:border-primary"
                  />
                  <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {phaseHours}h
                  </span>
                  <span className="text-xs text-muted-foreground">{phase.tasks.length} tâches</span>
                  <button onClick={() => deletePhase(pi)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Tasks */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-3">
                        {phase.tasks.map((task, ti) => {
                          const pCfg = priorityConfig[task.priority] || priorityConfig.P1;
                          return (
                            <div key={ti} className="rounded-xl border border-border bg-background/50 p-4">
                              <div className="flex items-center gap-3 mb-2">
                                <input
                                  value={task.title}
                                  onChange={(e) => updateTask(pi, ti, { title: e.target.value })}
                                  className="flex-1 font-medium text-sm bg-transparent focus:outline-none focus:border-b focus:border-primary"
                                />
                                <button
                                  onClick={() => cyclePriority(pi, ti)}
                                  className={`status-badge border cursor-pointer ${pCfg.class}`}
                                >
                                  {task.priority}
                                </button>
                                <input
                                  type="number"
                                  value={task.duration_hours}
                                  onChange={(e) => updateTask(pi, ti, { duration_hours: Number(e.target.value) || 1 })}
                                  className="w-14 text-xs font-mono text-center bg-muted rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                  min={1}
                                />
                                <span className="text-xs text-muted-foreground">h</span>
                                <button onClick={() => deleteTask(pi, ti)} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <input
                                value={task.description}
                                onChange={(e) => updateTask(pi, ti, { description: e.target.value })}
                                placeholder="Description (optionnelle)..."
                                className="w-full text-xs text-muted-foreground bg-transparent focus:outline-none mb-3"
                              />

                              {/* Subtasks */}
                              <div className="pl-4 border-l-2 border-border space-y-1.5">
                                {task.subtasks.map((st, si) => (
                                  <div key={si} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
                                    <input
                                      value={st.title}
                                      onChange={(e) => updateSubtask(pi, ti, si, { title: e.target.value })}
                                      className="flex-1 text-xs bg-transparent focus:outline-none focus:border-b focus:border-primary"
                                    />
                                    <input
                                      type="number"
                                      value={st.duration_hours}
                                      onChange={(e) => updateSubtask(pi, ti, si, { duration_hours: Number(e.target.value) || 1 })}
                                      className="w-12 text-[10px] font-mono text-center bg-muted rounded py-0.5 focus:outline-none"
                                      min={1}
                                    />
                                    <span className="text-[10px] text-muted-foreground">h</span>
                                    <button onClick={() => deleteSubtask(pi, ti, si)} className="text-muted-foreground hover:text-destructive">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => addSubtask(pi, ti)}
                                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors mt-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Sous-tâche
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          onClick={() => addTask(pi)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Ajouter une tâche
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Team Recommendations */}
        {plan.team_recommendations && plan.team_recommendations.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg">Équipe recommandée</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Profils à recruter pour la réalisation de votre projet professionnel.
            </p>
            <div className="space-y-3">
              {plan.team_recommendations.map((rec, i) => {
                const importanceConfig = {
                  "nécessaire": { icon: AlertTriangle, class: "text-destructive bg-destructive/10 border-destructive/30", label: "Nécessaire" },
                  "fortement recommandé": { icon: Shield, class: "text-amber-600 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800", label: "Fortement recommandé" },
                  "recommandé": { icon: Star, class: "text-primary bg-primary/10 border-primary/30", label: "Recommandé" },
                };
                const cfg = importanceConfig[rec.importance] || importanceConfig["recommandé"];
                const ImportanceIcon = cfg.icon;

                return (
                  <div key={i} className="rounded-xl border border-border bg-background/50 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{rec.role}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cfg.class}`}>
                        <ImportanceIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rec.skills.map((skill, si) => (
                        <span key={si} className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                          {skill}
                        </span>
                      ))}
                    </div>
                    {rec.estimated_monthly_cost && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        💰 Coût estimé : {rec.estimated_monthly_cost}/mois
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <CoherenceJustifications
          items={plan.coherence_justifications || []}
          bpId={bpId}
          bmId={bmId}
          onChange={(items) => setPlan({ ...plan, coherence_justifications: items })}
        />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/onboarding")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Recommencer
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-border hover:border-primary/30 hover:text-primary transition-all disabled:opacity-50"
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Régénération...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Régénérer le plan
                </>
              )}
            </button>
          </div>
          <button
            onClick={handleValidate}
            disabled={saving || plan.phases.length === 0}
            className="flex items-center gap-2 gradient-bg text-primary-foreground px-8 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all animate-glow"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Valider mon plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
