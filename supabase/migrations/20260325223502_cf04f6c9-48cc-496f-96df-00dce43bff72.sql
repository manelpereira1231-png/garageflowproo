
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
