-- Add country_code to partners for proper localization of affiliate payouts
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'PT';

CREATE INDEX IF NOT EXISTS idx_partners_country_code ON public.partners(country_code);