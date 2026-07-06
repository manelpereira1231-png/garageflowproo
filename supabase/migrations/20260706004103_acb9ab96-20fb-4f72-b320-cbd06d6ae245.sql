
-- Update the new-shop trigger: give every new shop a Pro trial for N days
-- (N = country_settings.saas_trial_days for the shop's country, fallback 30).
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _trial_days int;
BEGIN
  SELECT COALESCE(cs.saas_trial_days, 30)
    INTO _trial_days
    FROM public.country_settings cs
   WHERE cs.code = upper(COALESCE(NEW.country_code, 'PT'))
     AND cs.active = true
   LIMIT 1;

  IF _trial_days IS NULL OR _trial_days <= 0 THEN
    _trial_days := 30;
  END IF;

  INSERT INTO public.subscriptions (shop_id, plan, status, trial_end, billing_cycle)
  VALUES (
    NEW.id,
    'pro',
    'trialing',
    now() + make_interval(days => _trial_days),
    'monthly'
  );

  INSERT INTO public.shop_users (shop_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');

  RETURN NEW;
END;
$function$;
