
-- Chat messages table for GARAGE plan
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL,
  sender_id uuid,
  sender_type text NOT NULL DEFAULT 'staff',
  client_id uuid,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members manage chat"
ON public.chat_messages
FOR ALL
USING (
  (shop_id IN (SELECT get_user_shop_ids(auth.uid()))) OR is_super_admin(auth.uid())
)
WITH CHECK (
  (shop_id IN (SELECT get_user_shop_ids(auth.uid()))) OR is_super_admin(auth.uid())
);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Add follow_up columns to alerts
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS follow_up_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS last_follow_up_at timestamp with time zone;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS next_follow_up_at timestamp with time zone;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
