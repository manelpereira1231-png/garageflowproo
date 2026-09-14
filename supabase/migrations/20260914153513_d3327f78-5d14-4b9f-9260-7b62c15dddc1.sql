CREATE OR REPLACE FUNCTION public.is_listing_published(_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.carity_listings l
    WHERE l.id = _listing_id AND l.status = 'published'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_listing_published(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public read translations of published listings" ON public.carity_listing_translations;
CREATE POLICY "Public read translations of published listings"
ON public.carity_listing_translations
FOR SELECT
USING (public.is_listing_published(listing_id));