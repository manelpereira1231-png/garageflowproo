
CREATE OR REPLACE FUNCTION public.enforce_shop_country_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_country_locked boolean;
  v_country_code_locked boolean;
  v_currency_locked boolean;
BEGIN
  IF NEW.country_code IS NOT DISTINCT FROM OLD.country_code
     AND NEW.country IS NOT DISTINCT FROM OLD.country
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency
  THEN
    RETURN NEW;
  END IF;

  v_country_locked      := OLD.country      IS NOT NULL AND NEW.country      IS DISTINCT FROM OLD.country;
  v_country_code_locked := OLD.country_code IS NOT NULL AND NEW.country_code IS DISTINCT FROM OLD.country_code;
  v_currency_locked     := OLD.currency     IS NOT NULL AND NEW.currency     IS DISTINCT FROM OLD.currency;

  IF NOT v_country_locked AND NOT v_country_code_locked AND NOT v_currency_locked THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT public.is_super_admin() INTO v_is_super;
  EXCEPTION WHEN OTHERS THEN
    v_is_super := false;
  END;

  IF v_is_super THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'shop_country_immutable'
    USING ERRCODE = 'check_violation',
          HINT = 'Country / currency cannot be changed after the shop is created. Contact support.';
END;
$$;
