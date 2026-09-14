-- 1. seller_trust_scores: remove blanket public read, expose only display fields via RPC
DROP POLICY IF EXISTS "Public read trust scores" ON public.seller_trust_scores;
REVOKE SELECT ON public.seller_trust_scores FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_trust_score(_user_id uuid)
RETURNS TABLE (trust_level text, score_points integer, successful_sales integer, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.trust_level::text, t.score_points::integer, t.successful_sales::integer, t.avg_rating::numeric
  FROM public.seller_trust_scores t
  WHERE t.user_id = _user_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_trust_score(uuid) TO anon, authenticated;

-- 2. carity_listing_translations: only translations of published listings are public
DROP POLICY IF EXISTS "Anyone can read listing translations" ON public.carity_listing_translations;
CREATE POLICY "Public read translations of published listings"
ON public.carity_listing_translations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.carity_listings l
    WHERE l.id = carity_listing_translations.listing_id
      AND l.status = 'published'
  )
);

-- 3. reviews: only participants (reviewer or reviewed party) can read
DROP POLICY IF EXISTS "Authenticated can read buyer reviews" ON public.buyer_reviews;
CREATE POLICY "Participants can read buyer reviews"
ON public.buyer_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = reviewer_id OR auth.uid() = buyer_id OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read seller reviews" ON public.seller_reviews;
CREATE POLICY "Participants can read seller reviews"
ON public.seller_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = reviewer_id OR auth.uid() = seller_id OR is_super_admin(auth.uid()));