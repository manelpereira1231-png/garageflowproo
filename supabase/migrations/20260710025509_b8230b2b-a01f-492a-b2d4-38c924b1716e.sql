-- 1) Backfill city/region from location_label when missing
UPDATE public.carity_listings
   SET city = TRIM(SPLIT_PART(location_label, ',', 1))
 WHERE (city IS NULL OR city = '')
   AND location_label IS NOT NULL
   AND location_label <> '';

UPDATE public.carity_listings
   SET region = NULLIF(TRIM(SPLIT_PART(location_label, ',', 2)), '')
 WHERE (region IS NULL OR region = '')
   AND location_label IS NOT NULL
   AND POSITION(',' IN location_label) > 0;

-- 2) Translations cache table
CREATE TABLE IF NOT EXISTS public.carity_listing_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  title TEXT,
  description TEXT,
  source_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, language)
);

GRANT SELECT ON public.carity_listing_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carity_listing_translations TO authenticated;
GRANT ALL ON public.carity_listing_translations TO service_role;

ALTER TABLE public.carity_listing_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read listing translations"
  ON public.carity_listing_translations
  FOR SELECT
  USING (true);

CREATE POLICY "Sellers manage own listing translations"
  ON public.carity_listing_translations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carity_listings l
       WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carity_listings l
       WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_carity_listing_translations_lookup
  ON public.carity_listing_translations(listing_id, language);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_carity_translations_updated ON public.carity_listing_translations;
CREATE TRIGGER trg_carity_translations_updated
  BEFORE UPDATE ON public.carity_listing_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();