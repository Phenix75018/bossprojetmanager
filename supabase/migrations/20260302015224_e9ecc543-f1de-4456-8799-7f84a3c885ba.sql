
-- Team recommendations linked to a project
CREATE TABLE public.team_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  importance TEXT NOT NULL DEFAULT 'recommandé',
  skills TEXT[] NOT NULL DEFAULT '{}',
  estimated_monthly_cost TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.team_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project recommendations" ON public.team_recommendations FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = team_recommendations.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create recommendations in own projects" ON public.team_recommendations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = team_recommendations.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete recommendations in own projects" ON public.team_recommendations FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = team_recommendations.project_id AND projects.user_id = auth.uid()));

-- Alternatives chosen/explored for a recommendation
CREATE TABLE public.recommendation_alternatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID NOT NULL REFERENCES public.team_recommendations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration TEXT,
  estimated_cost TEXT,
  pros TEXT[] NOT NULL DEFAULT '{}',
  cons TEXT[] NOT NULL DEFAULT '{}',
  feasibility TEXT NOT NULL DEFAULT 'moyenne',
  chosen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendation_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alternatives" ON public.recommendation_alternatives FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_recommendations tr
    JOIN projects p ON p.id = tr.project_id
    WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can create alternatives" ON public.recommendation_alternatives FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM team_recommendations tr
    JOIN projects p ON p.id = tr.project_id
    WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update alternatives" ON public.recommendation_alternatives FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM team_recommendations tr
    JOIN projects p ON p.id = tr.project_id
    WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete alternatives" ON public.recommendation_alternatives FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM team_recommendations tr
    JOIN projects p ON p.id = tr.project_id
    WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()
  ));

-- Add project_type column to projects table
ALTER TABLE public.projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'personal';
