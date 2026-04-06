
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own versions" ON public.document_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own versions" ON public.document_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own versions" ON public.document_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_document_versions_lookup ON public.document_versions (document_type, document_id, version_number DESC);
