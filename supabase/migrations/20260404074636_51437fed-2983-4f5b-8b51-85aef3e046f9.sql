
CREATE TABLE public.business_plan_charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.business_plan_sections(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL DEFAULT 'bar',
  title TEXT NOT NULL DEFAULT '',
  chart_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_plan_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bp charts" ON public.business_plan_charts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_plan_sections bps
    JOIN business_plans bp ON bp.id = bps.business_plan_id
    WHERE bps.id = business_plan_charts.section_id AND bp.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own bp charts" ON public.business_plan_charts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM business_plan_sections bps
    JOIN business_plans bp ON bp.id = bps.business_plan_id
    WHERE bps.id = business_plan_charts.section_id AND bp.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own bp charts" ON public.business_plan_charts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_plan_sections bps
    JOIN business_plans bp ON bp.id = bps.business_plan_id
    WHERE bps.id = business_plan_charts.section_id AND bp.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own bp charts" ON public.business_plan_charts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_plan_sections bps
    JOIN business_plans bp ON bp.id = bps.business_plan_id
    WHERE bps.id = business_plan_charts.section_id AND bp.user_id = auth.uid()
  ));
