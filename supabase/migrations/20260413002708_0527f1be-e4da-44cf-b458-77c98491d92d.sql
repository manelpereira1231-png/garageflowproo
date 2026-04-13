
-- Add Carity partner fields to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS is_carity_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carity_priority integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS carity_active boolean NOT NULL DEFAULT true;

-- Table to track inspection offers sent to shops
CREATE TABLE public.carity_inspection_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES public.carity_inspections(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  rejection_reason text
);

ALTER TABLE public.carity_inspection_offers ENABLE ROW LEVEL SECURITY;

-- Shop members can see and respond to their offers
CREATE POLICY "Shop members manage own offers"
  ON public.carity_inspection_offers FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid()) AS get_user_shop_ids))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid()) AS get_user_shop_ids));

-- Super admin full access
CREATE POLICY "Super admin manage offers"
  ON public.carity_inspection_offers FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Sellers can see offers for their listings
CREATE POLICY "Sellers view own listing offers"
  ON public.carity_inspection_offers FOR SELECT
  USING (listing_id IN (SELECT id FROM carity_listings WHERE seller_id = auth.uid()));

-- Index for performance
CREATE INDEX idx_carity_offers_inspection ON public.carity_inspection_offers(inspection_id);
CREATE INDEX idx_carity_offers_shop ON public.carity_inspection_offers(shop_id, status);
CREATE INDEX idx_shops_carity_partner ON public.shops(is_carity_partner, carity_active);
