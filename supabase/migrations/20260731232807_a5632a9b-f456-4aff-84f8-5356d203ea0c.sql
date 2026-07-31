CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_code text;
  v_cs record;
  v_country_name text;
  v_currency text;
  v_language text;
  v_timezone text;
  v_vat numeric;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', 'garage') IN ('particular','affiliate')
     OR COALESCE(NEW.raw_user_meta_data->>'carity_user', 'false') = 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'is_affiliate', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.raw_user_meta_data->>'source', '') = 'child_shop_invite'
     OR COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'garage_child'
     OR COALESCE(NEW.raw_user_meta_data->>'skip_shop_creation', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  v_code := UPPER(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'country_code',''),
    CASE UPPER(COALESCE(NEW.raw_user_meta_data->>'shop_country',''))
      WHEN 'BRASIL' THEN 'BR' WHEN 'BRAZIL' THEN 'BR'
      WHEN 'PORTUGAL' THEN 'PT'
      WHEN 'ESPAÑA' THEN 'ES' WHEN 'SPAIN' THEN 'ES' WHEN 'ESPANHA' THEN 'ES'
      WHEN 'FRANCE' THEN 'FR' WHEN 'FRANÇA' THEN 'FR'
      WHEN 'DEUTSCHLAND' THEN 'DE' WHEN 'GERMANY' THEN 'DE' WHEN 'ALEMANHA' THEN 'DE'
      WHEN 'UNITED KINGDOM' THEN 'UK' WHEN 'UK' THEN 'UK'
      WHEN 'UNITED STATES' THEN 'US' WHEN 'USA' THEN 'US' WHEN 'US' THEN 'US'
      WHEN 'INDIA' THEN 'IN' WHEN 'ÍNDIA' THEN 'IN'
      ELSE NULL
    END,
    'PT'
  ));

  SELECT cs.code, cs.name, cs.currency, cs.default_language,
         (CASE
            WHEN cs.timezones IS NULL THEN NULL
            WHEN array_length(cs.timezones, 1) IS NULL THEN NULL
            ELSE cs.timezones[1]
          END) AS tz
    INTO v_cs
    FROM public.country_settings cs
   WHERE cs.code = v_code
   LIMIT 1;

  IF v_cs.code IS NULL THEN
    v_country_name := 'Portugal'; v_currency := 'EUR'; v_language := 'pt';
    v_timezone := 'Europe/Lisbon'; v_code := 'PT';
  ELSE
    v_country_name := v_cs.name;
    v_currency := v_cs.currency;
    v_language := v_cs.default_language;
    v_timezone := COALESCE(v_cs.tz, 'Europe/Lisbon');
  END IF;

  v_vat := CASE v_code
    WHEN 'PT' THEN 23 WHEN 'ES' THEN 21 WHEN 'FR' THEN 20
    WHEN 'DE' THEN 19 WHEN 'UK' THEN 20 WHEN 'BR' THEN 0
    WHEN 'US' THEN 0  WHEN 'IN' THEN 18 ELSE 0
  END;

  INSERT INTO public.shops (
    user_id, name, email, nif,
    country, country_code, currency, timezone, language, vat_rate
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'shop_nif', ''),
    v_country_name, v_code, v_currency, v_timezone, v_language, v_vat
  );

  RETURN NEW;
END;
$function$;