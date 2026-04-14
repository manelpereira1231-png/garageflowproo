-- Create the reusable updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Escrow table for marketplace transactions
CREATE TABLE public.market_escrow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  seller_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 2,
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  delivery_confirmed_at timestamptz,
  delivery_deadline timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  buyer_dispute_reason text,
  seller_dispute_response text,
  disputed_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers view own escrows"
ON public.market_escrow FOR SELECT TO authenticated
USING (buyer_id = auth.uid());

CREATE POLICY "Sellers view own escrows"
ON public.market_escrow FOR SELECT TO authenticated
USING (seller_id = auth.uid());

CREATE POLICY "Buyers create escrows"
ON public.market_escrow FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers update escrows"
ON public.market_escrow FOR UPDATE TO authenticated
USING (buyer_id = auth.uid());

CREATE POLICY "Sellers update escrows"
ON public.market_escrow FOR UPDATE TO authenticated
USING (seller_id = auth.uid());

CREATE POLICY "Super admin manage escrows"
ON public.market_escrow FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_market_escrow_listing ON public.market_escrow(listing_id);
CREATE INDEX idx_market_escrow_buyer ON public.market_escrow(buyer_id);
CREATE INDEX idx_market_escrow_seller ON public.market_escrow(seller_id);
CREATE INDEX idx_market_escrow_status ON public.market_escrow(status);

CREATE TRIGGER update_market_escrow_updated_at
BEFORE UPDATE ON public.market_escrow
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_escrow;