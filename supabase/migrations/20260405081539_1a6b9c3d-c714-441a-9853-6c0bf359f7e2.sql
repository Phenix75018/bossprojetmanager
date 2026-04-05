
-- Business Models table
CREATE TABLE public.business_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  framework TEXT NOT NULL DEFAULT 'bmc',
  status TEXT NOT NULL DEFAULT 'draft',
  share_token TEXT,
  share_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business models" ON public.business_models FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own business models" ON public.business_models FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own business models" ON public.business_models FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own business models" ON public.business_models FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Business Model Blocks table
CREATE TABLE public.business_model_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_model_id UUID NOT NULL REFERENCES public.business_models(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_model_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bm blocks" ON public.business_model_blocks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.business_models WHERE id = business_model_blocks.business_model_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own bm blocks" ON public.business_model_blocks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.business_models WHERE id = business_model_blocks.business_model_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own bm blocks" ON public.business_model_blocks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.business_models WHERE id = business_model_blocks.business_model_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own bm blocks" ON public.business_model_blocks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.business_models WHERE id = business_model_blocks.business_model_id AND user_id = auth.uid()));
