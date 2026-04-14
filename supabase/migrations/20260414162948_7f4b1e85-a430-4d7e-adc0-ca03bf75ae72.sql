-- Enable realtime on notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Chat messages between buyers and sellers
CREATE TABLE public.carity_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text', -- text, offer, offer_accepted, offer_rejected, system
  offer_amount numeric DEFAULT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carity_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations"
  ON public.carity_chat_messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users send messages"
  ON public.carity_chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receiver marks as read"
  ON public.carity_chat_messages FOR UPDATE
  USING (receiver_id = auth.uid());

CREATE POLICY "Super admin manage chat"
  ON public.carity_chat_messages FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX idx_carity_chat_listing ON public.carity_chat_messages(listing_id, created_at);
CREATE INDEX idx_carity_chat_users ON public.carity_chat_messages(sender_id, receiver_id);

-- Offers / proposals
CREATE TABLE public.carity_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, expired, paid
  stripe_session_id text DEFAULT NULL,
  expires_at timestamptz DEFAULT (now() + interval '48 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz DEFAULT NULL
);

ALTER TABLE public.carity_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and sellers see own offers"
  ON public.carity_offers FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Buyers create offers"
  ON public.carity_offers FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Sellers respond to offers"
  ON public.carity_offers FOR UPDATE
  USING (seller_id = auth.uid());

CREATE POLICY "Super admin manage offers"
  ON public.carity_offers FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX idx_carity_offers_listing ON public.carity_offers(listing_id, status);

-- Enable realtime on chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.carity_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.carity_offers;