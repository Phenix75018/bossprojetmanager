ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS assumption_scenarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active_scenario text NOT NULL DEFAULT 'base';