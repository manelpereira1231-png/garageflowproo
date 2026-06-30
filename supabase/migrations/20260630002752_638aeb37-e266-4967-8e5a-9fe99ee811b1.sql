
ALTER TABLE public.country_settings
  ADD COLUMN IF NOT EXISTS saas_free_monthly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saas_free_yearly  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_free_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_free_yearly  text,
  ADD COLUMN IF NOT EXISTS stripe_free_product_id text;
