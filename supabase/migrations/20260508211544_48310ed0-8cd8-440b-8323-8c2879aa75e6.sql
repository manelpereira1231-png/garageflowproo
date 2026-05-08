CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Every new shop gets 30 days of Pro on the house (trial).
  -- No stripe_subscription_id => admin MRR excludes it (revenue = 0).
  INSERT INTO public.subscriptions (shop_id, plan, status, trial_end, billing_cycle)
  VALUES (NEW.id, 'pro', 'trialing', now() + interval '30 days', 'monthly');

  INSERT INTO public.shop_users (shop_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');

  RETURN NEW;
END;
$function$;