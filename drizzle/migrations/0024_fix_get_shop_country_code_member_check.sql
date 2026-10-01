CREATE OR REPLACE FUNCTION public.get_shop_country_code(shop_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_country text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  -- Só devolve se o utilizador for membro/dono da oficina (ordem correta: user, shop)
  IF NOT public.user_is_shop_member(auth.uid(), get_shop_country_code.shop_id) THEN
    RETURN NULL;
  END IF;
  SELECT s.country_code INTO v_country FROM public.shops s WHERE s.id = get_shop_country_code.shop_id LIMIT 1;
  RETURN v_country;
END;
$function$;