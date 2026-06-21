import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Users,
  AlertTriangle,
  Shield,
  Star,
  BookOpen,
  GraduationCap,
  Wrench,
  UserCheck,
  Bot,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

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

const importanceIcons: Record<string, typeof Shield> = {
  nécessaire: Shield,
  "fortement recommandé": AlertTriangle,
  recommandé: Star,
};

const alternativeTypeIcons: Record<string, typeof BookOpen> = {
  formation: GraduationCap,
  coaching: UserCheck,
  "outil/logiciel": Wrench,
  freelance: Users,
  externalisation: Bot,
  autoformation: BookOpen,
};

export default function SharedPlan() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const fetchPlan = (pwd?: string) => {
    if (!token) return;
    setLoading(true);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    // POST with JSON body so the password is never exposed in URLs, logs, or browser history.
    fetch(`https://${projectId}.supabase.co/functions/v1/get-shared-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...(pwd ? { password: pwd } : {}) }),
    })
      .then((res) => res.json())
      .then((d) => {
        if (d.needs_password) {
          setNeedsPassword(true);
          if (pwd) setPasswordError(true);
        } else if (d.error) {
          setError(d.error);
        } else {
          setData(d);
          setNeedsPassword(false);
          if (d.phases?.length > 0) setExpandedPhases(new Set([d.phases[0].id]));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger le plan");
        setLoading(false);
      });
  };

  useEffect(() => { fetchPlan(); }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    fetchPlan(passwordInput);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-bold mb-2">Plan protégé</h1>
          <p className="text-sm text-muted-foreground mb-6">Ce plan est protégé par un mot de passe.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Mot de passe"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive">Mot de passe incorrect</p>}
            <button type="submit" disabled={!passwordInput} className="w-full gradient-bg text-primary-foreground rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
              Accéder au plan
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Plan introuvable</h1>
          <p className="text-muted-foreground">{error || "Ce lien de partage n'est pas valide."}</p>
        </div>
      </div>
    );
  }

  const { project, phases, explanations, recommendations, alternatives } = data;
  const allTasks = phases.flatMap((p: any) => p.tasks);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t: any) => t.status === "done").length;
  const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const explanationMap: Record<string, string> = {};
  (explanations || []).forEach((e: any) => {
    if (e.task_id) explanationMap[e.task_id] = e.explanation;
    if (e.subtask_id) explanationMap[e.subtask_id] = e.explanation;
  });

  const alternativesByRec: Record<string, any[]> = {};
  (alternatives || []).forEach((a: any) => {
    if (!alternativesByRec[a.recommendation_id]) alternativesByRec[a.recommendation_id] = [];
    alternativesByRec[a.recommendation_id].push(a);
  });

  const togglePhase = (id: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTask = (id: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <span className="font-display font-bold text-lg">Boss PM</span>
          </div>
          <span className="text-xs text-muted-foreground">Plan partagé en lecture seule</span>
        </div>
      </div>

      <div className="container pt-8 pb-12 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-black">{project.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm max-w-xl">{project.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-primary">{percent}%</div>
            <div className="text-xs text-muted-foreground mt-1">{doneTasks}/{totalTasks} tâches</div>
            <div className="w-32 h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-4">
          {phases.map((phase: any) => {
            const isExpanded = expandedPhases.has(phase.id);
            const phaseDone = phase.tasks.filter((t: any) => t.status === "done").length;
            const phasePercent = phase.tasks.length > 0 ? Math.round((phaseDone / phase.tasks.length) * 100) : 0;

            return (
              <div key={phase.id} className="glass-card rounded-2xl overflow-hidden">
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-primary" /> : <ChevronRight className="w-5 h-5" />}
                    <h2 className="text-lg font-display font-bold">{phase.name}</h2>
                    <span className="text-xs text-muted-foreground">{phase.tasks.length} tâches</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full gradient-bg rounded-full" style={{ width: `${phasePercent}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{phasePercent}%</span>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-2">
                        {phase.tasks.map((task: any) => {
                          const StatusIcon = statusConfig[(task.status as TaskStatus)]?.icon || Circle;
                          const statusClass = statusConfig[(task.status as TaskStatus)]?.class || "";
                          const priorityCfg = priorityConfig[task.priority];
                          const hasSubtasks = task.subtasks?.length > 0;
                          const isTaskExpanded = expandedTasks.has(task.id);
                          const hasExplanation = !!explanationMap[task.id];

                          return (
                            <div key={task.id} className="bg-background/50 rounded-xl border border-border/50">
                              <div className="flex items-center gap-3 p-3">
                                <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusClass}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{task.title}</span>
                                    {task.optional && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Optionnel</span>}
                                  </div>
                                  {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {priorityCfg && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityCfg.class}`}>{priorityCfg.label}</span>}
                                  <span className="text-xs text-muted-foreground font-mono">{task.duration_hours}h</span>
                                  {(hasSubtasks || hasExplanation) && (
                                    <button onClick={() => toggleTask(task.id)} className="p-1 hover:bg-accent rounded">
                                      {isTaskExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <AnimatePresence>
                                {isTaskExpanded && (
                                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                    <div className="px-3 pb-3 space-y-2">
                                      {hasSubtasks && (
                                        <div className="ml-6 space-y-1">
                                          {task.subtasks.map((st: any) => {
                                            const StIcon = statusConfig[(st.status as TaskStatus)]?.icon || Circle;
                                            const stClass = statusConfig[(st.status as TaskStatus)]?.class || "";
                                            const stHasExpl = !!explanationMap[st.id];
                                            const stExplExpanded = expandedExplanations.has(st.id);

                                            return (
                                              <div key={st.id}>
                                                <div className="flex items-center gap-2 py-1">
                                                  <StIcon className={`w-3.5 h-3.5 ${stClass}`} />
                                                  <span className="text-xs flex-1">{st.title}</span>
                                                  <span className="text-[10px] text-muted-foreground font-mono">{st.duration_hours}h</span>
                                                  {stHasExpl && (
                                                    <button onClick={() => toggleExplanation(st.id)} className="p-0.5 hover:bg-accent rounded">
                                                      <BookOpen className="w-3 h-3 text-primary" />
                                                    </button>
                                                  )}
                                                </div>
                                                {stHasExpl && stExplExpanded && (
                                                  <div className="ml-6 mb-2 p-3 bg-primary/5 rounded-lg border border-primary/10 text-xs prose prose-sm max-w-none">
                                                    <ReactMarkdown>{explanationMap[st.id]}</ReactMarkdown>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {hasExplanation && (
                                        <div className="ml-6">
                                          <button
                                            onClick={() => toggleExplanation(task.id)}
                                            className="flex items-center gap-1.5 text-xs text-primary hover:underline mb-1"
                                          >
                                            <BookOpen className="w-3 h-3" />
                                            {expandedExplanations.has(task.id) ? "Masquer le guide" : "Voir le guide détaillé"}
                                          </button>
                                          {expandedExplanations.has(task.id) && (
                                            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-xs prose prose-sm max-w-none">
                                              <ReactMarkdown>{explanationMap[task.id]}</ReactMarkdown>
                                            </div>
                                          )}
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Team Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recommandations d'équipe
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {recommendations.map((rec: any) => {
                const ImportIcon = importanceIcons[rec.importance] || Star;
                const recAlts = alternativesByRec[rec.id];

                return (
                  <div key={rec.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <ImportIcon className="w-4 h-4 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-bold text-sm">{rec.role}</h3>
                        <span className="text-[10px] text-muted-foreground capitalize">{rec.importance}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {rec.skills?.map((s: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{s}</span>
                      ))}
                    </div>
                    {rec.estimated_monthly_cost && (
                      <p className="text-xs text-muted-foreground">Coût estimé : {rec.estimated_monthly_cost}</p>
                    )}

                    {/* Alternatives */}
                    {recAlts && recAlts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Alternatives</p>
                        <div className="space-y-2">
                          {recAlts.map((alt: any) => {
                            const AltIcon = alternativeTypeIcons[alt.type] || BookOpen;
                            return (
                              <div key={alt.id} className="bg-background/50 rounded-lg p-2 border border-border/30">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <AltIcon className="w-3 h-3 text-primary" />
                                  <span className="text-xs font-medium">{alt.title}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{alt.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-muted-foreground">
          Généré par <span className="font-semibold">Boss Project Manager</span>
        </div>
      </div>
    </div>
  );
}
