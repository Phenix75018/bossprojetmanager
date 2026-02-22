
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  hours_per_week INTEGER NOT NULL DEFAULT 20,
  days_per_week TEXT[] NOT NULL DEFAULT '{"Lundi","Mardi","Mercredi","Jeudi","Vendredi"}',
  time_slots TEXT DEFAULT '9h-12h, 14h-18h',
  deadline DATE,
  completion_percent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phases table
CREATE TABLE public.phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'P1',
  status TEXT NOT NULL DEFAULT 'todo',
  duration_hours NUMERIC NOT NULL DEFAULT 4,
  dependencies UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subtasks table
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  duration_hours NUMERIC NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Phases policies (via project ownership)
CREATE POLICY "Users can view phases of own projects" ON public.phases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create phases in own projects" ON public.phases FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update phases in own projects" ON public.phases FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete phases in own projects" ON public.phases FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));

-- Tasks policies (via phase -> project ownership)
CREATE POLICY "Users can view tasks of own projects" ON public.tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.phases JOIN public.projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create tasks in own projects" ON public.tasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.phases JOIN public.projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update tasks in own projects" ON public.tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.phases JOIN public.projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete tasks in own projects" ON public.tasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.phases JOIN public.projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));

-- Subtasks policies (via task -> phase -> project ownership)
CREATE POLICY "Users can view subtasks of own projects" ON public.subtasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tasks JOIN public.phases ON phases.id = tasks.phase_id JOIN public.projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create subtasks in own projects" ON public.subtasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks JOIN public.phases ON phases.id = tasks.phase_id JOIN public.projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update subtasks in own projects" ON public.subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.tasks JOIN public.phases ON phases.id = tasks.phase_id JOIN public.projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete subtasks in own projects" ON public.subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.tasks JOIN public.phases ON phases.id = tasks.phase_id JOIN public.projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
