-- Admin RPC: returns full country_settings rows (including Stripe IDs) only to super admins.
-- Frontend AdminCountries page calls this instead of SELECT * which is column-restricted for security.
CREATE OR REPLACE FUNCTION public.admin_list_country_settings()
RETURNS SETOF public.country_settings
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.country_settings ORDER BY active DESC, name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_country_settings() TO authenticated;