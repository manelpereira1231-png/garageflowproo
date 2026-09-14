-- Public read of legal_settings limited to non-sensitive identity fields.
DROP POLICY IF EXISTS "legal_settings_public_read" ON public.legal_settings;

CREATE POLICY "legal_settings_authenticated_read"
  ON public.legal_settings
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.legal_settings FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_legal_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'company_name', l.company_name,
    'trade_name', l.trade_name,
    'tax_id', NULL,
    'address', NULL,
    'postal_code', NULL,
    'city', l.city,
    'country', l.country,
    'contact_email', l.contact_email,
    'contact_phone', l.contact_phone,
    'website', l.website,
    'share_capital', NULL,
    'at_certified', l.at_certified,
    'at_certificate_number', l.at_certificate_number,
    'privacy_policy', l.privacy_policy,
    'terms_of_service', l.terms_of_service,
    'footer_text', l.footer_text,
    'copyright_text', l.copyright_text,
    'social_links', l.social_links,
    'show_in_footer', l.show_in_footer
  )
  FROM public.legal_settings l
  WHERE l.singleton = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_legal_settings() TO anon, authenticated;