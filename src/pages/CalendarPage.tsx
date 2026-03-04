import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, Share2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useProjectsDB, ProjectWithDetails } from "@/hooks/useProjectsDB";
import CalendarView from "@/components/CalendarView";
import ShareCalendarModal from "@/components/ShareCalendarModal";

export default function CalendarPage() {
  const { projects, loading: projectsLoading, fetchProjectWithDetails, updateTaskStatus, updateProjectCompletion } = useProjectsDB();
  const [allProjects, setAllProjects] = useState<ProjectWithDetails[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  const loadAllDetails = useCallback(async () => {
    if (projects.length === 0) {
      setLoading(false);
      return;
    }
    const detailed = await Promise.all(
      projects.map((p) => fetchProjectWithDetails(p.id))
    );
    setAllProjects(detailed.filter(Boolean) as ProjectWithDetails[]);
    setLoading(false);
  }, [projects, fetchProjectWithDetails]);

  useEffect(() => {
    if (!projectsLoading) {
      loadAllDetails();
    }
  }, [projectsLoading, loadAllDetails]);

  const selectedProject = selectedProjectId === "all"
    ? null
    : allProjects.find((p) => p.id === selectedProjectId) || null;

  // Merge all projects into a virtual "all projects" view
  const mergedProject: ProjectWithDetails | null =
    selectedProject ||
    (allProjects.length > 0
      ? {
          ...allProjects[0],
          id: "all",
          title: "Tous les projets",
          description: "",
          phases: allProjects.flatMap((p) =>
            p.phases.map((phase) => ({
              ...phase,
              name: `${p.title} — ${phase.name}`,
            }))
          ),
        }
      : null);

  const handleCycleStatus = async (taskId: string, current: string) => {
    const order = ["todo", "in-progress", "done"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    await updateTaskStatus(taskId, next);

    setAllProjects((prev) =>
      prev.map((proj) => {
        const updated = {
          ...proj,
          phases: proj.phases.map((phase) => ({
            ...phase,
            tasks: phase.tasks.map((t) =>
              t.id === taskId ? { ...t, status: next } : t
            ),
          })),
        };
        const all = updated.phases.flatMap((p) => p.tasks);
        const done = all.filter((t) => t.status === "done").length;
        const newPercent = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
        if (updated.completion_percent !== newPercent) {
          updated.completion_percent = newPercent;
          updateProjectCompletion(proj.id, newPercent);
        }
        return updated;
      })
    );
  };

  if (loading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
            <h1 className="text-3xl font-display font-black">Calendrier</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Vue calendrier de toutes vos tâches planifiées
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Partager
            </button>
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Tous les projets</option>
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {mergedProject ? (
          <CalendarView
            project={mergedProject}
            onCycleStatus={handleCycleStatus}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            Aucun projet trouvé. Créez votre premier projet pour voir le calendrier.
          </div>
        )}
      </div>
    </div>
  );
}
