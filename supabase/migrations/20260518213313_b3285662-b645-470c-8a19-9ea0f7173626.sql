
-- 1) Update handle_new_user to also skip shop creation for affiliates
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip shop creation for Market/particular/affiliate users
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', 'garage') IN ('particular','affiliate')
     OR COALESCE(NEW.raw_user_meta_data->>'skip_shop_creation', 'false') = 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'carity_user', 'false') = 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'is_affiliate', 'false') = 'true' THEN
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

-- 2) Clean up shops accidentally created for existing affiliates (empty only)
DELETE FROM public.shops s
WHERE s.user_id IN (SELECT auth_user_id FROM public.partners WHERE auth_user_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.clients     WHERE shop_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.vehicles    WHERE shop_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE shop_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.quotes      WHERE shop_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoices    WHERE shop_id = s.id);
