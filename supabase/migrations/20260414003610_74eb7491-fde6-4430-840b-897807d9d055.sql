CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Skip shop creation for Market/particular users
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', 'garage') = 'particular' 
     OR COALESCE(NEW.raw_user_meta_data->>'skip_shop_creation', 'false') = 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'carity_user', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shops (user_id, name, email, country, nif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'shop_country', 'Portugal'),
    COALESCE(NEW.raw_user_meta_data->>'shop_nif', '')
  );
  RETURN NEW;
END;
$function$;