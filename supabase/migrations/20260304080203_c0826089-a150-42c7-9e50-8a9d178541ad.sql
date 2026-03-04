-- Add share_token column to projects for public sharing
ALTER TABLE public.projects ADD COLUMN share_token TEXT UNIQUE DEFAULT NULL;

-- Create index for fast lookup by share_token
CREATE INDEX idx_projects_share_token ON public.projects (share_token) WHERE share_token IS NOT NULL;