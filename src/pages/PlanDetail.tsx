import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  LayoutList,
  Columns3,
  CalendarDays,
  ArrowLeft,
  Loader2,
  Pencil,
  Users,
  AlertTriangle,
  Shield,
  Star,
  Lightbulb,
  BookOpen,
  X,
  GraduationCap,
  Wrench,
  UserCheck,
  Bot,
   Download,
   Share2,
    FileText,
    LayoutGrid,
  } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useProjectsDB, ProjectWithDetails, TaskRow } from "@/hooks/useProjectsDB";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CalendarView from "@/components/CalendarView";
import TaskEditModal from "@/components/TaskEditModal";
import TaskExplainModal from "@/components/TaskExplainModal";
import SharePlanModal from "@/components/SharePlanModal";
import { exportFullPlanPDF } from "@/lib/pdfExport";
import { useBusinessPlans } from "@/hooks/useBusinessPlans";

type TaskStatus = "todo" | "in-progress" | "done";

const priorityConfig: Record<string, { label: string; class: string }> = {
  P0: { label: "Critique", class: "priority-critical" },
  P1: { label: "Haute", class: "priority-high" },
  P2: { label: "Normale", class: "priority-low" },
};

const statusConfig: Record<TaskStatus, { label: string; icon: typeof Circle; class: string }> = {
  todo: { label: "À faire", icon: Circle, class: "text-muted-foreground" },
  "in-progress": { label: "En cours", icon: Clock, class: "text-primary" },
  done: { label: "Terminé", icon: CheckCircle2, class: "text-teal-700" },
};

type ViewMode = "list" | "kanban" | "calendar";

interface TeamRecommendation {
  role: string;
  description: string;
  importance: "nécessaire" | "fortement recommandé" | "recommandé";
  skills: string[];
  estimated_monthly_cost: string;
}

interface AlternativeResult {
  has_alternatives: boolean;
  summary: string;
  alternatives: {
    type: string;
    title: string;
    description: string;
    duration: string;
    estimated_cost: string;
    pros: string[];
    cons: string[];
    feasibility: string;
  }[];
  no_alternative_reason: string | null;
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchProjectWithDetails, updateTaskStatus, updateTask, deleteTask, deleteSubtask, updateProjectCompletion } = useProjectsDB();
  const { plans, createPlan } = useBusinessPlans();
  const [creatingBP, setCreatingBP] = useState(false);
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<(TaskRow & { subtasks: any[] }) | null>(null);

  // Team recommendations from DB
  const [teamRecommendations, setTeamRecommendations] = useState<(TeamRecommendation & { id: string })[]>([]);
  const [projectType, setProjectType] = useState("personal");
  
  // Alternatives exploration
  const [exploringRole, setExploringRole] = useState<string | null>(null);
  const [alternativesResult, setAlternativesResult] = useState<AlternativeResult | null>(null);
  const [savedAlternatives, setSavedAlternatives] = useState<Record<string, AlternativeResult>>({});
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // Task explanation modal
  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const [explainTarget, setExplainTarget] = useState<{
    title: string;
    description?: string | null;
    subtasks?: { title: string; duration_hours: number }[];
    phaseName: string;
    isSubtask: boolean;
    taskId?: string;
    subtaskId?: string;
  } | null>(null);

  const loadProject = useCallback(async () => {
    if (!id) return;
    const data = await fetchProjectWithDetails(id);
    setProject(data);
    setLoading(false);
    // Auto-expand first phase
    if (data && data.phases.length > 0) {
      setExpandedPhases(new Set([data.phases[0].id]));
    }

    // Load project type + share_token
    if (data) {
      const { data: projData } = await supabase
        .from("projects")
        .select("project_type, share_token")
        .eq("id", id)
        .single();
      if (projData?.project_type) setProjectType(projData.project_type);
      if ((projData as any)?.share_token) setShareToken((projData as any).share_token);
    }

    // Load team recommendations from DB
    const { data: recs } = await supabase
      .from("team_recommendations")
      .select("*")
      .eq("project_id", id)
      .order("sort_order");
    if (recs && recs.length > 0) {
      setTeamRecommendations(recs as any);

      // Load saved alternatives for each recommendation
      const recIds = recs.map((r: any) => r.id);
      const { data: alts } = await supabase
        .from("recommendation_alternatives")
        .select("*")
        .in("recommendation_id", recIds);
      if (alts && alts.length > 0) {
        const grouped: Record<string, AlternativeResult> = {};
        for (const rec of recs) {
          const recAlts = alts.filter((a: any) => a.recommendation_id === rec.id);
          if (recAlts.length > 0) {
            grouped[rec.id] = {
              has_alternatives: true,
              summary: "Alternatives sauvegardées",
              alternatives: recAlts.map((a: any) => ({
                type: a.type,
                title: a.title,
                description: a.description,
                duration: a.duration,
                estimated_cost: a.estimated_cost,
                pros: a.pros || [],
                cons: a.cons || [],
                feasibility: a.feasibility,
              })),
              no_alternative_reason: null,
            };
          }
        }
        setSavedAlternatives(grouped);
      }
    }
  }, [id, fetchProjectWithDetails]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-28 text-center">
          <h1 className="text-2xl font-bold mb-4">Projet introuvable</h1>
          <Link to="/dashboard" className="text-primary hover:underline">
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  const allTasks = project.phases.flatMap((p) => p.tasks);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  };

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const cycleStatus = async (taskId: string, current: string) => {
    const order: TaskStatus[] = ["todo", "in-progress", "done"];
    const next = order[(order.indexOf(current as TaskStatus) + 1) % order.length];
    await updateTaskStatus(taskId, next);

    // Update local state
    setProject((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        phases: prev.phases.map((phase) => ({
          ...phase,
          tasks: phase.tasks.map((t) => (t.id === taskId ? { ...t, status: next } : t)),
        })),
      };
      const all = updated.phases.flatMap((p) => p.tasks);
      const done = all.filter((t) => t.status === "done").length;
      const newPercent = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
      updated.completion_percent = newPercent;
      updateProjectCompletion(prev.id, newPercent);
      return updated;
    });
  };

  const handleSaveTask = async (taskId: string, updates: { title: string; description: string | null; priority: string; duration_hours: number }) => {
    await updateTask(taskId, updates);
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: prev.phases.map((phase) => ({
          ...phase,
          tasks: phase.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        })),
      };
    });
  };

  const handleDeleteTask = async (taskId: string): Promise<boolean> => {
    const ok = await deleteTask(taskId);
    if (ok) {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          phases: prev.phases.map((phase) => ({
            ...phase,
            tasks: phase.tasks.filter((t) => t.id !== taskId),
          })),
        };
        const all = updated.phases.flatMap((p) => p.tasks);
        const done = all.filter((t) => t.status === "done").length;
        const newPercent = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
        updated.completion_percent = newPercent;
        updateProjectCompletion(prev.id, newPercent);
        return updated;
      });
    }
    return ok;
  };

  const handleDeleteSubtask = async (subtaskId: string): Promise<boolean> => {
    const ok = await deleteSubtask(subtaskId);
    if (ok) {
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((phase) => ({
            ...phase,
            tasks: phase.tasks.map((t) => ({
              ...t,
              subtasks: t.subtasks.filter((st: any) => st.id !== subtaskId),
            })),
          })),
        };
      });
    }
    return ok;
  };

  const handleExportPDF = async () => {
    if (!project) return;
    toast.info("Génération du PDF en cours…");
    try {
      // Load all saved explanations
      const allTaskIds = project.phases.flatMap(p => p.tasks.map(t => t.id));
      const allSubtaskIds = project.phases.flatMap(p => p.tasks.flatMap(t => t.subtasks.map((st: any) => st.id)));
      const explanations: Record<string, string> = {};

      if (allTaskIds.length > 0) {
        const { data: taskExpl } = await supabase.from("task_explanations").select("task_id, explanation").in("task_id", allTaskIds);
        taskExpl?.forEach(e => { if (e.task_id) explanations[e.task_id] = e.explanation; });
      }
      if (allSubtaskIds.length > 0) {
        const { data: stExpl } = await supabase.from("task_explanations").select("subtask_id, explanation").in("subtask_id", allSubtaskIds);
        stExpl?.forEach(e => { if (e.subtask_id) explanations[e.subtask_id] = e.explanation; });
      }

      // Load alternatives by recommendation
      const alternativesByRec: Record<string, any[]> = {};
      for (const rec of teamRecommendations) {
        const { data: alts } = await supabase.from("recommendation_alternatives").select("*").eq("recommendation_id", rec.id);
        if (alts && alts.length > 0) alternativesByRec[rec.id] = alts;
      }

      const allTasks = project.phases.flatMap(p => p.tasks);
      const doneTasks = allTasks.filter(t => t.status === "done").length;
      const percent = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;

      await exportFullPlanPDF({
        title: project.title,
        description: project.description,
        phases: project.phases.map(p => ({
          name: p.name,
          tasks: p.tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            duration_hours: t.duration_hours,
            optional: t.optional,
            subtasks: t.subtasks.map((st: any) => ({ id: st.id, title: st.title, status: st.status, duration_hours: st.duration_hours })),
          })),
        })),
        percent,
        totalTasks: allTasks.length,
        doneTasks,
        recommendations: teamRecommendations,
        alternativesByRec,
        explanations,
      });
      toast.success("PDF exporté avec succès !");
    } catch (err: any) {
      toast.error("Erreur lors de l'export PDF");
    }
  };

  const handleExploreAlternatives = async (rec: TeamRecommendation & { id: string }) => {
    // Check if we have saved alternatives
    if (savedAlternatives[rec.id]) {
      setExploringRole(rec.role);
      setAlternativesResult(savedAlternatives[rec.id]);
      return;
    }

    setExploringRole(rec.role);
    setLoadingAlternatives(true);
    setAlternativesResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("explore-alternatives", {
        body: {
          role: rec.role,
          description: rec.description,
          skills: rec.skills,
          importance: rec.importance,
          projectDescription: project?.description || "",
        },
      });
      if (error) throw error;
      setAlternativesResult(data);

      // Save alternatives to DB
      if (data?.has_alternatives && data.alternatives?.length > 0) {
        const altsToInsert = data.alternatives.map((alt: any) => ({
          recommendation_id: rec.id,
          type: alt.type,
          title: alt.title,
          description: alt.description || "",
          duration: alt.duration || null,
          estimated_cost: alt.estimated_cost || null,
          pros: alt.pros || [],
          cons: alt.cons || [],
          feasibility: alt.feasibility || "moyenne",
        }));
        await supabase.from("recommendation_alternatives").insert(altsToInsert);
        setSavedAlternatives((prev) => ({ ...prev, [rec.id]: data }));
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la recherche d'alternatives");
      setExploringRole(null);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const alternativeTypeIcons: Record<string, typeof BookOpen> = {
    formation: GraduationCap,
    coaching: UserCheck,
    "outil/logiciel": Wrench,
    freelance: Users,
    externalisation: Bot,
    autoformation: BookOpen,
  };

  // Kanban
  const kanbanColumns = [
    { status: "todo" as TaskStatus, label: "À faire", tasks: allTasks.filter((t) => t.status === "todo") },
    { status: "in-progress" as TaskStatus, label: "En cours", tasks: allTasks.filter((t) => t.status === "in-progress") },
    { status: "done" as TaskStatus, label: "Terminé", tasks: allTasks.filter((t) => t.status === "done") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
            <h1 className="text-3xl font-display font-black">{project.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm max-w-xl">{project.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-primary">{percent}%</div>
            <div className="text-xs text-muted-foreground mt-1">{doneTasks}/{totalTasks} tâches</div>
            <div className="w-32 h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div className="h-full gradient-bg rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager
              </button>
              <button
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
              {(() => {
                const existingBP = plans.find(p => p.project_id === id);
                if (existingBP) {
                  return (
                    <button
                      onClick={() => navigate(`/business-plan/${existingBP.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Business Plan
                    </button>
                  );
                }
                return (
                  <button
                    disabled={creatingBP}
                    onClick={async () => {
                      if (!project) return;
                      setCreatingBP(true);
                      const bpId = await createPlan(project.title, project.description, id);
                      setCreatingBP(false);
                      if (bpId) navigate(`/business-plan/${bpId}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all disabled:opacity-50"
                  >
                    {creatingBP ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Business Plan
                  </button>
                );
              })()}
            </div>
          </div>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-2 mb-6">
          {([
            { mode: "list" as ViewMode, icon: LayoutList, label: "Liste" },
            { mode: "kanban" as ViewMode, icon: Columns3, label: "Kanban" },
            { mode: "calendar" as ViewMode, icon: CalendarDays, label: "Calendrier" },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === mode ? "gradient-bg text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {project.phases.map((phase) => {
              const isExpanded = expandedPhases.has(phase.id);
              const phaseDone = phase.tasks.filter((t) => t.status === "done").length;
              const phasePercent = phase.tasks.length > 0 ? Math.round((phaseDone / phase.tasks.length) * 100) : 0;

              return (
                <motion.div key={phase.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl overflow-hidden">
                  <button onClick={() => togglePhase(phase.id)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-muted/30 transition-colors">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    <h3 className="font-display font-bold flex-1">{phase.name}</h3>
                    <span className="text-xs text-muted-foreground font-mono">{phaseDone}/{phase.tasks.length}</span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${phasePercent}%` }} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-5 pb-5 space-y-2">
                          {phase.tasks.map((task) => {
                            const taskExpanded = expandedTasks.has(task.id);
                            const StatusIcon = statusConfig[(task.status as TaskStatus) || "todo"].icon;
                            const pCfg = priorityConfig[task.priority] || priorityConfig.P1;

                            return (
                              <div key={task.id} className="rounded-xl border border-border bg-background/50">
                                <div className="flex items-center gap-3 p-4">
                                  <button onClick={() => cycleStatus(task.id, task.status)} className={`${statusConfig[(task.status as TaskStatus) || "todo"].class} transition-colors`}>
                                    <StatusIcon className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => toggleTask(task.id)} className="flex-1 text-left">
                                    <span className={`font-medium text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                      {task.title}
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => setExplainTarget({
                                      title: task.title,
                                      description: task.description,
                                      subtasks: task.subtasks.map((st: any) => ({ title: st.title, duration_hours: st.duration_hours })),
                                      phaseName: phase.name,
                                      isSubtask: false,
                                      taskId: task.id,
                                    })}
                                    className="p-1 rounded-lg hover:bg-primary/10 transition-colors"
                                    title="Comment réaliser cette tâche"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                                  </button>
                                  <span className={`status-badge border ${pCfg.class}`}>{task.priority}</span>
                                  <span className="text-xs font-mono text-muted-foreground">{task.duration_hours}h</span>
                                  <button onClick={() => setEditingTask(task)} className="p-1 rounded-lg hover:bg-muted transition-colors" title="Modifier">
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                  {task.subtasks.length > 0 && (
                                    <button onClick={() => toggleTask(task.id)}>
                                      {taskExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                  )}
                                </div>

                                <AnimatePresence>
                                  {taskExpanded && task.subtasks.length > 0 && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border overflow-hidden">
                                      <div className="p-4 pl-12 space-y-2">
                                        {task.subtasks.map((st) => (
                                          <div key={st.id} className="flex items-center gap-3 text-sm group/subtask">
                                            <div className={`w-4 h-4 rounded-full border-2 ${st.status === "done" ? "bg-teal-600 border-teal-600" : "border-muted-foreground/30"}`} />
                                            <button
                                              onClick={() => setExplainTarget({
                                                title: st.title,
                                                phaseName: phase.name,
                                                isSubtask: true,
                                                subtaskId: st.id,
                                              })}
                                              className={`text-left flex-1 hover:text-primary transition-colors ${st.status === "done" ? "line-through text-muted-foreground" : ""}`}
                                            >
                                              {st.title}
                                            </button>
                                            <span className="ml-auto text-xs font-mono text-muted-foreground">{st.duration_hours}h</span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* KANBAN VIEW */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {kanbanColumns.map((col) => (
              <div key={col.status} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.status === "todo" ? "bg-muted-foreground" : col.status === "in-progress" ? "bg-primary" : "bg-teal-600"}`} />
                  <h3 className="font-display font-bold text-sm">{col.label}</h3>
                  <span className="text-xs text-muted-foreground font-mono ml-auto">{col.tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {col.tasks.map((task) => {
                    const pCfg = priorityConfig[task.priority] || priorityConfig.P1;
                    return (
                      <motion.div key={task.id} layout className="glass-card-hover rounded-xl p-4 cursor-pointer group" onClick={() => cycleStatus(task.id, task.status)}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-sm leading-tight">{task.title}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const taskPhase = project.phases.find(p => p.tasks.some(t => t.id === task.id));
                                setExplainTarget({
                                  title: task.title,
                                  description: task.description,
                                  subtasks: task.subtasks.map((st: any) => ({ title: st.title, duration_hours: st.duration_hours })),
                                  phaseName: taskPhase?.name || "",
                                  isSubtask: false,
                                  taskId: task.id,
                                });
                              }}
                              className="p-1 rounded-lg hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Comment réaliser cette tâche"
                            >
                              <BookOpen className="w-3 h-3 text-muted-foreground" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                              className="p-1 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                              title="Modifier"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground" />
                            </button>
                            <span className={`status-badge border text-[10px] ${pCfg.class}`}>{task.priority}</span>
                          </div>
                        </div>
                        {task.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-muted-foreground">{task.duration_hours}h</span>
                          <span className="text-xs text-muted-foreground">{task.subtasks.length} sous-tâches</span>
                        </div>
                      </motion.div>
                    );
                  })}
                  {col.tasks.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">Aucune tâche</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CALENDAR VIEW */}
        {viewMode === "calendar" && (
          <CalendarView project={project} onCycleStatus={cycleStatus} />
        )}

        {/* TEAM RECOMMENDATIONS */}
        {teamRecommendations.length > 0 && projectType === "professional" && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg">Équipe recommandée</h3>
            </div>
            <div className="space-y-3">
              {teamRecommendations.map((rec, i) => {
                const importanceConfig = {
                  "nécessaire": { icon: AlertTriangle, class: "text-destructive bg-destructive/10 border-destructive/30", label: "Nécessaire" },
                  "fortement recommandé": { icon: Shield, class: "text-amber-600 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800", label: "Fortement recommandé" },
                  "recommandé": { icon: Star, class: "text-primary bg-primary/10 border-primary/30", label: "Recommandé" },
                };
                const cfg = importanceConfig[rec.importance] || importanceConfig["recommandé"];
                const ImportanceIcon = cfg.icon;
                const isExploring = exploringRole === rec.role;

                return (
                  <div key={i} className="glass-card rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{rec.role}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{rec.description}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap ${cfg.class}`}>
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
                      <p className="text-xs text-muted-foreground mt-2">💰 Coût estimé : {rec.estimated_monthly_cost}/mois</p>
                    )}
                    <div className="mt-3">
                      <button
                        onClick={() => handleExploreAlternatives(rec)}
                        disabled={loadingAlternatives}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:border-primary/30 hover:text-primary transition-all disabled:opacity-50"
                      >
                        {loadingAlternatives && isExploring ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Recherche d'alternatives...
                          </>
                        ) : (
                          <>
                            <Lightbulb className="w-4 h-4" />
                            Explorer d'autres alternatives
                          </>
                        )}
                      </button>
                    </div>

                    {/* Alternatives panel */}
                    <AnimatePresence>
                      {isExploring && alternativesResult && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 p-4 rounded-xl border border-border bg-background/50">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-sm flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-primary" />
                                Alternatives au recrutement
                              </h5>
                              <button onClick={() => { setExploringRole(null); setAlternativesResult(null); }} className="p-1 hover:bg-muted rounded-lg">
                                <X className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">{alternativesResult.summary}</p>

                            {alternativesResult.has_alternatives ? (
                              <div className="space-y-3">
                                {alternativesResult.alternatives.map((alt, ai) => {
                                  const AltIcon = alternativeTypeIcons[alt.type] || BookOpen;
                                  const feasibilityColors = {
                                    haute: "text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950",
                                    moyenne: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
                                    faible: "text-destructive bg-destructive/10",
                                  };
                                  return (
                                    <div key={ai} className="rounded-lg border border-border p-3">
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                          <AltIcon className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm">{alt.title}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${feasibilityColors[alt.feasibility as keyof typeof feasibilityColors] || feasibilityColors.moyenne}`}>
                                              Faisabilité {alt.feasibility}
                                            </span>
                                          </div>
                                          <p className="text-xs text-muted-foreground mb-2">{alt.description}</p>
                                          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                            {alt.duration && <span>⏱ {alt.duration}</span>}
                                            {alt.estimated_cost && <span>💰 {alt.estimated_cost}</span>}
                                          </div>
                                          {alt.pros.length > 0 && (
                                            <div className="mt-2">
                                              <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 mb-0.5">Avantages</p>
                                              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                                                {alt.pros.map((p, pi) => <li key={pi}>✓ {p}</li>)}
                                              </ul>
                                            </div>
                                          )}
                                          {alt.cons.length > 0 && (
                                            <div className="mt-1.5">
                                              <p className="text-[10px] font-semibold text-destructive mb-0.5">Inconvénients</p>
                                              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                                                {alt.cons.map((c, ci) => <li key={ci}>✗ {c}</li>)}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                                <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
                                <p className="text-sm font-medium text-destructive">Pas d'alternative viable</p>
                                <p className="text-xs text-muted-foreground mt-1">{alternativesResult.no_alternative_reason}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TaskEditModal
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onDeleteSubtask={handleDeleteSubtask}
      />

      <TaskExplainModal
        open={!!explainTarget}
        onClose={() => setExplainTarget(null)}
        taskTitle={explainTarget?.title || ""}
        taskDescription={explainTarget?.description}
        subtasks={explainTarget?.subtasks}
        projectDescription={project?.description || ""}
        phaseName={explainTarget?.phaseName || ""}
        isSubtask={explainTarget?.isSubtask || false}
        taskId={explainTarget?.taskId}
        subtaskId={explainTarget?.subtaskId}
      />

      <SharePlanModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        projectId={project.id}
        projectTitle={project.title}
        shareToken={shareToken}
        onTokenGenerated={(t) => setShareToken(t || null)}
      />
    </div>
  );
}
