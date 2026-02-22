
-- Add custom reminder delays columns (in minutes)
ALTER TABLE public.notification_preferences
  ADD COLUMN reminder_1_minutes INTEGER NOT NULL DEFAULT 720,  -- 12h
  ADD COLUMN reminder_2_minutes INTEGER NOT NULL DEFAULT 5;     -- 5min
