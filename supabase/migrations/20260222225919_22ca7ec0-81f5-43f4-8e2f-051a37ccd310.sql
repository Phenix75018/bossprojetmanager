
-- Fix: replace overly permissive INSERT policy with service-role-only access
DROP POLICY "Service can insert sent notifications" ON public.sent_notifications;

-- Only allow inserts where user_id matches (edge function uses service role which bypasses RLS anyway)
CREATE POLICY "Users can insert own sent notifications"
ON public.sent_notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);
