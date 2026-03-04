-- Create calendar_shares table for public calendar sharing
CREATE TABLE public.calendar_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- One share per user
CREATE UNIQUE INDEX idx_calendar_shares_user ON public.calendar_shares (user_id);

-- Enable RLS
ALTER TABLE public.calendar_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar share"
ON public.calendar_shares FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);