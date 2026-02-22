export type Priority = "P0" | "P1" | "P2";
export type TaskStatus = "todo" | "in-progress" | "done";
export type ProjectStatus = "idea" | "planning" | "in-progress" | "halfway" | "finalizing";
export type ViewMode = "list" | "kanban" | "timeline";

export interface SubTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  duration: number; // in hours
  optional?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  phase: string;
  priority: Priority;
  status: TaskStatus;
  duration: number; // in hours
  subtasks: SubTask[];
  dependencies: string[]; // task ids
  tags: string[];
  notes?: string;
  order: number;
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
}

export interface ProjectAvailability {
  daysPerWeek: string[];
  hoursPerWeek: number;
  timeSlots: string;
  deadline?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  availability: ProjectAvailability;
  phases: Phase[];
  createdAt: string;
  completionPercent: number;
}

export interface OnboardingData {
  description: string;
  status: ProjectStatus;
  statusDetails: string;
  availability: ProjectAvailability;
}
