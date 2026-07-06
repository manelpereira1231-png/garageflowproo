
CREATE TABLE IF NOT EXISTS public.platform_company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL DEFAULT 'GarageFlow',
  tax_id TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'PT',
  iban TEXT,
  accountant_email TEXT,
  accountant_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_company_info TO authenticated;
GRANT ALL ON public.platform_company_info TO service_role;

ALTER TABLE public.platform_company_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_full_access_platform_company_info" ON public.platform_company_info;
CREATE POLICY "super_admin_full_access_platform_company_info"
ON public.platform_company_info
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_platform_company_info_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_company_info_updated_at ON public.platform_company_info;
CREATE TRIGGER trg_platform_company_info_updated_at
BEFORE UPDATE ON public.platform_company_info
FOR EACH ROW EXECUTE FUNCTION public.update_platform_company_info_updated_at();

-- Seed default row so admin UI has something to edit
INSERT INTO public.platform_company_info (legal_name, country)
SELECT 'GarageFlow', 'PT'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_company_info);
