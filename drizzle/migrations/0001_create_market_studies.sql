CREATE TABLE public.market_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_studies TO authenticated;
GRANT ALL ON public.market_studies TO service_role;
ALTER TABLE public.market_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.market_studies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.market_studies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.market_studies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.market_studies FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER market_studies_updated BEFORE UPDATE ON public.market_studies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();