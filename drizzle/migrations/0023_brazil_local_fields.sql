ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS renavam text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS tax_regime text;
ALTER TABLE public.insurer_catalog ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'PT';
CREATE INDEX IF NOT EXISTS idx_insurer_catalog_country ON public.insurer_catalog(country_code);