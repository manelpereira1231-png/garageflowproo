ALTER TABLE public.carity_listings
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- Backfill from seller profiles (best signal we have for existing rows)
UPDATE public.carity_listings l
   SET country_code = sp.country_code
  FROM public.carity_seller_profiles sp
 WHERE sp.user_id = l.seller_id
   AND l.country_code IS NULL
   AND sp.country_code IS NOT NULL;

-- Backfill from shop when no seller profile country
UPDATE public.carity_listings l
   SET country_code = s.country_code
  FROM public.shops s
 WHERE s.id = l.shop_id
   AND l.country_code IS NULL
   AND s.country_code IS NOT NULL;

UPDATE public.carity_listings
   SET country_code = 'PT'
 WHERE country_code IS NULL;

-- Fill currency from country_settings
UPDATE public.carity_listings l
   SET currency = cs.currency
  FROM public.country_settings cs
 WHERE l.country_code = cs.code
   AND l.currency IS NULL;

UPDATE public.carity_listings SET currency = 'EUR' WHERE currency IS NULL;

ALTER TABLE public.carity_listings
  ALTER COLUMN country_code SET NOT NULL,
  ALTER COLUMN country_code SET DEFAULT 'PT',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN currency SET DEFAULT 'EUR';

CREATE INDEX IF NOT EXISTS idx_carity_listings_country ON public.carity_listings(country_code) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_carity_listings_country_city ON public.carity_listings(country_code, city) WHERE status = 'published';