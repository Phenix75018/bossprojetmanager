
-- Table to track sent email notifications (avoid duplicates)
CREATE TABLE public.sent_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '12h' or '5min'
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id, reminder_type)
);

ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sent notifications"
ON public.sent_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert sent notifications"
ON public.sent_notifications FOR INSERT
WITH CHECK (true);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
