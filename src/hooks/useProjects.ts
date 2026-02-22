import { useState, useCallback } from "react";
import { Project, OnboardingData, Task, TaskStatus } from "@/lib/types";
import { generateMockProject, demoProjects } from "@/lib/mockData";

const STORAGE_KEY = "boss-projects";

function loadProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [...demoProjects];
  } catch {
    return [...demoProjects];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  const persist = useCallback((updated: Project[]) => {
    setProjects(updated);
    saveProjects(updated);
  }, []);

  const createProject = useCallback(
    (data: OnboardingData): Project => {
      const project = generateMockProject(data.description);
      project.status = data.status;
      project.availability = data.availability;
      const updated = [project, ...projects];
      persist(updated);
      return project;
    },
    [projects, persist]
  );

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects]
  );

  const updateTaskStatus = useCallback(
    (projectId: string, taskId: string, status: TaskStatus) => {
      const updated = projects.map((p) => {
        if (p.id !== projectId) return p;
        const phases = p.phases.map((phase) => ({
          ...phase,
          tasks: phase.tasks.map((t) =>
            t.id === taskId ? { ...t, status } : t
          ),
        }));
        const total = phases.flatMap((ph) => ph.tasks);
        const done = total.filter((t) => t.status === "done").length;
        return {
          ...p,
          phases,
          completionPercent: Math.round((done / total.length) * 100),
        };
      });
      persist(updated);
    },
    [projects, persist]
  );

  const deleteProject = useCallback(
    (id: string) => {
      persist(projects.filter((p) => p.id !== id));
    },
    [projects, persist]
  );

  return { projects, createProject, getProject, updateTaskStatus, deleteProject };
}
