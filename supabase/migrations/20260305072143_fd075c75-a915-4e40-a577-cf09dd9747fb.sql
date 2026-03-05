
ALTER TABLE public.projects ADD COLUMN share_password text DEFAULT NULL;
ALTER TABLE public.calendar_shares ADD COLUMN share_password text DEFAULT NULL;
