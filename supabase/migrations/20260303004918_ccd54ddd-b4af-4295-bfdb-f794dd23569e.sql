
CREATE TABLE public.task_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  subtask_id UUID REFERENCES public.subtasks(id) ON DELETE CASCADE,
  explanation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  CONSTRAINT task_or_subtask CHECK (
    (task_id IS NOT NULL AND subtask_id IS NULL) OR
    (task_id IS NULL AND subtask_id IS NOT NULL)
  )
);

ALTER TABLE public.task_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own explanations"
ON public.task_explanations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own explanations"
ON public.task_explanations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own explanations"
ON public.task_explanations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own explanations"
ON public.task_explanations FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_task_explanations_task_id ON public.task_explanations(task_id);
CREATE INDEX idx_task_explanations_subtask_id ON public.task_explanations(subtask_id);
