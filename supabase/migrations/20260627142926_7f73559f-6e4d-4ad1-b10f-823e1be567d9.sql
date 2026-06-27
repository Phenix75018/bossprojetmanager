ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS business_assumptions JSONB NOT NULL DEFAULT '{}'::jsonb;