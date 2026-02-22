
-- Drop existing foreign keys and recreate with CASCADE
ALTER TABLE public.phases DROP CONSTRAINT phases_project_id_fkey;
ALTER TABLE public.phases ADD CONSTRAINT phases_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.tasks DROP CONSTRAINT tasks_phase_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_phase_id_fkey 
  FOREIGN KEY (phase_id) REFERENCES public.phases(id) ON DELETE CASCADE;

ALTER TABLE public.subtasks DROP CONSTRAINT subtasks_task_id_fkey;
ALTER TABLE public.subtasks ADD CONSTRAINT subtasks_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_events DROP CONSTRAINT calendar_events_project_id_fkey;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_events DROP CONSTRAINT calendar_events_task_id_fkey;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
