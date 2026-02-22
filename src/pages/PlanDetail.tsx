import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useProjectsDB, ProjectWithDetails, TaskRow } from "@/hooks/useProjectsDB";
import CalendarView from "@/components/CalendarView";
import TaskEditModal from "@/components/TaskEditModal";

type TaskStatus = "todo" | "in-progress" | "done";

const priorityConfig: Record<string, { label: string; class: string }> = {
  P0: { label: "Critique", class: "priority-critical" },
  P1: { label: "Haute", class: "priority-high" },
  P2: { label: "Normale", class: "priority-low" },
};

const statusConfig: Record<TaskStatus, { label: string; icon: typeof Circle; class: string }> = {
  todo: { label: "À faire", icon: Circle, class: "text-muted-foreground" },
  "in-progress": { label: "En cours", icon: Clock, class: "text-primary" },
  done: { label: "Terminé", icon: CheckCircle2, class: "text-emerald-500" },
};

type ViewMode = "list" | "kanban" | "calendar";

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { fetchProjectWithDetails, updateTaskStatus, updateTask, updateProjectCompletion } = useProjectsDB();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<(TaskRow & { subtasks: any[] }) | null>(null);

  const loadProject = useCallback(async () => {
    if (!id) return;
    const data = await fetchProjectWithDetails(id);
    setProject(data);
    setLoading(false);
    // Auto-expand first phase
    if (data && data.phases.length > 0) {
      setExpandedPhases(new Set([data.phases[0].id]));
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
                                          <div key={st.id} className="flex items-center gap-3 text-sm">
                                            <div className={`w-4 h-4 rounded-full border-2 ${st.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"}`} />
                                            <span className={st.status === "done" ? "line-through text-muted-foreground" : ""}>{st.title}</span>
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
                  <div className={`w-2.5 h-2.5 rounded-full ${col.status === "todo" ? "bg-muted-foreground" : col.status === "in-progress" ? "bg-primary" : "bg-emerald-500"}`} />
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
      </div>

      <TaskEditModal
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
      />
    </div>
  );
}
