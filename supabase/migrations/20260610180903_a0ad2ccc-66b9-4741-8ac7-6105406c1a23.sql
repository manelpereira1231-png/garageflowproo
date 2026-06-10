
-- Seller reviews (buyer rates seller)
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reviewer_id, listing_id)
);
GRANT SELECT ON public.seller_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_reviews TO authenticated;
GRANT ALL ON public.seller_reviews TO service_role;
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read seller reviews" ON public.seller_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create own seller reviews" ON public.seller_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update own seller reviews" ON public.seller_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete own seller reviews" ON public.seller_reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

-- Buyer reviews (seller rates buyer)
CREATE TABLE IF NOT EXISTS public.buyer_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reviewer_id, listing_id, buyer_id)
);
GRANT SELECT ON public.buyer_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_reviews TO authenticated;
GRANT ALL ON public.buyer_reviews TO service_role;
ALTER TABLE public.buyer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read buyer reviews" ON public.buyer_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create own buyer reviews" ON public.buyer_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update own buyer reviews" ON public.buyer_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete own buyer reviews" ON public.buyer_reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS seller_reviews_set_updated ON public.seller_reviews;
CREATE TRIGGER seller_reviews_set_updated BEFORE UPDATE ON public.seller_reviews FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS buyer_reviews_set_updated ON public.buyer_reviews;
CREATE TRIGGER buyer_reviews_set_updated BEFORE UPDATE ON public.buyer_reviews FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- C: Activity tracking on shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0;
