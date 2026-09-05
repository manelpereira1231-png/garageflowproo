GRANT EXECUTE ON FUNCTION public.admin_list_plan_country_prices() TO authenticated;

GRANT SELECT ON public.carity_seller_profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.carity_seller_profiles FROM anon;

GRANT SELECT ON public.plan_country_prices TO authenticated;

CREATE OR REPLACE FUNCTION public._ai_setting_numeric(_key text, _default numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v jsonb; t text;
BEGIN
  SELECT value INTO v FROM public.platform_settings WHERE key = _key LIMIT 1;
  IF v IS NULL THEN RETURN _default; END IF;
  IF jsonb_typeof(v) = 'object' THEN v := v -> 'value'; END IF;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN _default; END IF;
  t := trim(both '"' from (v #>> '{}'));
  IF t IS NULL OR t = '' THEN RETURN _default; END IF;
  BEGIN
    RETURN t::numeric;
  EXCEPTION WHEN others THEN
    RETURN _default;
  END;
END;
$function$;