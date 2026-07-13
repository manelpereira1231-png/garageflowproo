
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS required_skill text;
