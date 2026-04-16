-- Listing views (público, anti-spam por sessão+dia)
CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  session_id text,
  user_id uuid,
  viewed_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS listing_views_unique_per_day ON public.listing_views (listing_id, COALESCE(session_id, user_id::text), viewed_date);
CREATE INDEX IF NOT EXISTS listing_views_listing_idx ON public.listing_views(listing_id, viewed_date DESC);

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_record_view" ON public.listing_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anyone_can_count_views" ON public.listing_views
  FOR SELECT USING (true);

-- Listing favorites
CREATE TABLE IF NOT EXISTS public.listing_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, user_id)
);
CREATE INDEX IF NOT EXISTS listing_favorites_user_idx ON public.listing_favorites(user_id);
CREATE INDEX IF NOT EXISTS listing_favorites_listing_idx ON public.listing_favorites(listing_id);

ALTER TABLE public.listing_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_favorites_select" ON public.listing_favorites
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "users_manage_own_favorites_insert" ON public.listing_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_manage_own_favorites_delete" ON public.listing_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Shop reviews
CREATE TABLE IF NOT EXISTS public.shop_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  inspection_id uuid REFERENCES public.carity_inspections(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, reviewer_id, inspection_id)
);
CREATE INDEX IF NOT EXISTS shop_reviews_shop_idx ON public.shop_reviews(shop_id, created_at DESC);

ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_reviews" ON public.shop_reviews
  FOR SELECT USING (true);

CREATE POLICY "verified_buyers_can_review" ON public.shop_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.carity_inspections ci
      JOIN public.market_escrow me ON me.listing_id = ci.listing_id
      WHERE ci.shop_id = shop_reviews.shop_id
        AND me.buyer_id = auth.uid()
        AND me.status IN ('released', 'delivery_confirmed')
    )
  );

CREATE POLICY "users_can_edit_own_review" ON public.shop_reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);

CREATE POLICY "users_can_delete_own_review" ON public.shop_reviews
  FOR DELETE USING (auth.uid() = reviewer_id OR public.is_super_admin(auth.uid()));