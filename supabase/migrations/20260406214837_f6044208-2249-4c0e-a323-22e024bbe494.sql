
-- Table budgets prévisionnels
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  horizon_months INTEGER NOT NULL DEFAULT 12,
  share_token TEXT,
  share_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own budgets" ON public.budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Table lignes budgétaires
CREATE TABLE public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  monthly_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_total BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget lines" ON public.budget_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
CREATE POLICY "Users can create own budget lines" ON public.budget_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
CREATE POLICY "Users can update own budget lines" ON public.budget_lines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
CREATE POLICY "Users can delete own budget lines" ON public.budget_lines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
