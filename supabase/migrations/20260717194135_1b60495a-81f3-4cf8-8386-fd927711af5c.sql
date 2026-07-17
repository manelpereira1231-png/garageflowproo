
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  v_status text;
  v_customer text;
  v_sub text;
  v_cycle text;
  v_revenue_type text;
BEGIN
  SELECT s.plan, s.status, s.stripe_customer_id, s.stripe_subscription_id, s.billing_cycle, s.revenue_type
    INTO v_plan, v_status, v_customer, v_sub, v_cycle, v_revenue_type
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  JOIN public.plans p ON p.slug = s.plan
  WHERE sh.group_owner_id = NEW.group_owner_id
    AND sh.id <> NEW.id
    AND p.active = true
  ORDER BY p.sort_order DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  IF v_plan IS NULL THEN
    v_plan := public.get_default_plan_slug();
    v_status := 'active';
    v_cycle := 'monthly';
    v_revenue_type := 'free';
  END IF;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_PLAN_AVAILABLE'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.subscriptions (
    shop_id, plan, billing_cycle, status, stripe_customer_id, stripe_subscription_id, revenue_type
  )
  VALUES (
    NEW.id, v_plan, COALESCE(v_cycle, 'monthly'),
    COALESCE(v_status, 'active'), v_customer, v_sub, COALESCE(v_revenue_type, 'free')
  )
  ON CONFLICT (shop_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
