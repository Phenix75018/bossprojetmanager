
-- Business plans table
CREATE TABLE public.business_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  share_token TEXT,
  share_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Business plan sections table
CREATE TABLE public.business_plan_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.business_plans(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plan_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies for business_plans
CREATE POLICY "Users can view own business plans" ON public.business_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own business plans" ON public.business_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own business plans" ON public.business_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own business plans" ON public.business_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for business_plan_sections
CREATE POLICY "Users can view own bp sections" ON public.business_plan_sections FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.business_plans WHERE business_plans.id = business_plan_sections.business_plan_id AND business_plans.user_id = auth.uid()));
CREATE POLICY "Users can create own bp sections" ON public.business_plan_sections FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.business_plans WHERE business_plans.id = business_plan_sections.business_plan_id AND business_plans.user_id = auth.uid()));
CREATE POLICY "Users can update own bp sections" ON public.business_plan_sections FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.business_plans WHERE business_plans.id = business_plan_sections.business_plan_id AND business_plans.user_id = auth.uid()));
CREATE POLICY "Users can delete own bp sections" ON public.business_plan_sections FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.business_plans WHERE business_plans.id = business_plan_sections.business_plan_id AND business_plans.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_business_plans_updated_at BEFORE UPDATE ON public.business_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_plan_sections_updated_at BEFORE UPDATE ON public.business_plan_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
