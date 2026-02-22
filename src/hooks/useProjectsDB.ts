import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ProjectRow {
  id: string;
  title: string;
  description: string;
  status: string;
  hours_per_week: number;
  days_per_week: string[];
  time_slots: string | null;
  deadline: string | null;
  completion_percent: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface PhaseRow {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface TaskRow {
  id: string;
  phase_id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  duration_hours: number;
  dependencies: string[] | null;
  tags: string[] | null;
  notes: string | null;
  optional: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  status: string;
  duration_hours: number;
  sort_order: number;
  created_at: string;
}

export interface ProjectWithDetails extends ProjectRow {
  phases: (PhaseRow & {
    tasks: (TaskRow & {
      subtasks: SubtaskRow[];
    })[];
  })[];
}

export function useProjectsDB() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur lors du chargement des projets");
      console.error(error);
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchProjectWithDetails = useCallback(
    async (projectId: string): Promise<ProjectWithDetails | null> => {
      if (!user) return null;

      const { data: project, error: pErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (pErr || !project) return null;

      const { data: phases } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");

      const phaseIds = (phases || []).map((p) => p.id);
      
      let tasks: TaskRow[] = [];
      if (phaseIds.length > 0) {
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("*")
          .in("phase_id", phaseIds)
          .order("sort_order");
        tasks = (tasksData as TaskRow[]) || [];
      }

      const taskIds = tasks.map((t) => t.id);
      let subtasks: SubtaskRow[] = [];
      if (taskIds.length > 0) {
        const { data: subtasksData } = await supabase
          .from("subtasks")
          .select("*")
          .in("task_id", taskIds)
          .order("sort_order");
        subtasks = (subtasksData as SubtaskRow[]) || [];
      }

      // Assemble
      const phasesWithTasks = (phases || []).map((phase) => ({
        ...phase,
        tasks: tasks
          .filter((t) => t.phase_id === phase.id)
          .map((task) => ({
            ...task,
            subtasks: subtasks.filter((st) => st.task_id === task.id),
          })),
      }));

      return { ...project, phases: phasesWithTasks } as ProjectWithDetails;
    },
    [user]
  );

  const createProjectFromAI = useCallback(
    async (plan: any, description: string, status: string, availability: any): Promise<string | null> => {
      if (!user) return null;

      // Create project
      const { data: project, error: projectErr } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: plan.title || description.slice(0, 60),
          description,
          status,
          hours_per_week: availability.hoursPerWeek || 20,
          days_per_week: availability.daysPerWeek || [],
          time_slots: availability.timeSlots || null,
          deadline: availability.deadline || null,
        })
        .select()
        .single();

      if (projectErr || !project) {
        toast.error("Erreur lors de la création du projet");
        console.error(projectErr);
        return null;
      }

      // Create phases and tasks
      for (let pi = 0; pi < (plan.phases || []).length; pi++) {
        const phase = plan.phases[pi];
        const { data: phaseRow, error: phaseErr } = await supabase
          .from("phases")
          .insert({
            project_id: project.id,
            name: phase.name,
            sort_order: pi,
          })
          .select()
          .single();

        if (phaseErr || !phaseRow) continue;

        for (let ti = 0; ti < (phase.tasks || []).length; ti++) {
          const task = phase.tasks[ti];
          const { data: taskRow, error: taskErr } = await supabase
            .from("tasks")
            .insert({
              phase_id: phaseRow.id,
              title: task.title,
              description: task.description || null,
              priority: task.priority || "P1",
              duration_hours: task.duration_hours || 4,
              sort_order: ti,
            })
            .select()
            .single();

          if (taskErr || !taskRow) continue;

          const subtasksToInsert = (task.subtasks || []).map((st: any, si: number) => ({
            task_id: taskRow.id,
            title: st.title,
            duration_hours: st.duration_hours || 1,
            sort_order: si,
          }));

          if (subtasksToInsert.length > 0) {
            await supabase.from("subtasks").insert(subtasksToInsert);
          }
        }
      }

      await fetchProjects();
      return project.id;
    },
    [user, fetchProjects]
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", taskId);
      if (error) toast.error("Erreur lors de la mise à jour");
    },
    []
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);
      if (error) {
        toast.error("Erreur lors de la suppression");
      } else {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        toast.success("Projet supprimé");
      }
    },
    []
  );

  const updateProjectCompletion = useCallback(
    async (projectId: string, percent: number) => {
      await supabase
        .from("projects")
        .update({ completion_percent: percent })
        .eq("id", projectId);
    },
    []
  );

  return {
    projects,
    loading,
    fetchProjects,
    fetchProjectWithDetails,
    createProjectFromAI,
    updateTaskStatus,
    deleteProject,
    updateProjectCompletion,
  };
}
