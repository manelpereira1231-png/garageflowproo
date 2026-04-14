
-- Create boosts table
CREATE TABLE public.carity_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  boost_type TEXT NOT NULL DEFAULT '7d',
  price NUMERIC NOT NULL DEFAULT 5.99,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carity_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own boosts"
ON public.carity_boosts FOR ALL TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Super admin manage boosts"
ON public.carity_boosts FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Add boost columns to listings for fast querying
ALTER TABLE public.carity_listings
ADD COLUMN IF NOT EXISTS boost_active BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

-- Update default inspection pricing to 24.90€ with 65/35 split
ALTER TABLE public.carity_inspections
ALTER COLUMN payment_amount SET DEFAULT 24.90,
ALTER COLUMN shop_share SET DEFAULT 16.19,
ALTER COLUMN platform_share SET DEFAULT 8.72;

-- Update default commission rate to 3%
ALTER TABLE public.carity_listings
ALTER COLUMN commission_rate SET DEFAULT 3;
