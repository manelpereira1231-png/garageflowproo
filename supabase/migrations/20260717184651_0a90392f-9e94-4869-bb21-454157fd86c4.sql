-- Allow subscriptions to use any plan slug created in Admin instead of the old fixed list.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Dynamic source of truth for the entry/default plan.
CREATE OR REPLACE FUNCTION public.get_default_plan_slug()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.slug
  FROM public.plans p
  WHERE p.active = true
  ORDER BY p.sort_order ASC NULLS LAST, p.created_at ASC NULLS LAST, p.slug ASC
  LIMIT 1
$$;

-- Shop creation status must be based on the user's real best active plan and
-- must not depend on hardcoded plan names.
CREATE OR REPLACE FUNCTION public.get_shop_creation_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current int := 0;
  v_plan text;
  v_max int := 1;
BEGIN
  SELECT COUNT(*)
  INTO v_current
  FROM public.shops
  WHERE user_id = _user_id;

  SELECT s.plan
  INTO v_plan
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  JOIN public.plans p ON p.slug = s.plan
  WHERE sh.user_id = _user_id
    AND p.active = true
  ORDER BY p.sort_order DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  IF v_plan IS NULL THEN
    v_plan := public.get_default_plan_slug();
  END IF;

  SELECT COALESCE((p.limits->>'max_shops')::int, 1)
  INTO v_max
  FROM public.plans p
  WHERE p.slug = v_plan;

  IF v_max IS NULL THEN
    v_max := 1;
  END IF;

  RETURN jsonb_build_object(
    'allowed', (v_max < 0) OR (v_current < v_max),
    'current', v_current,
    'max', v_max,
    'plan', v_plan
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_shop_creation_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status jsonb;
BEGIN
  v_status := public.get_shop_creation_status(_user_id);
  RETURN COALESCE((v_status->>'allowed')::boolean, false);
END;
$$;

-- New shop subscriptions inherit the best active subscription owned by the same
-- account. If none exists, use the first active plan from Admin. No fixed names.
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE sh.user_id = NEW.user_id
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
    shop_id,
    plan,
    billing_cycle,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    revenue_type
  )
  VALUES (
    NEW.id,
    v_plan,
    COALESCE(v_cycle, 'monthly'),
    COALESCE(v_status, 'active'),
    v_customer,
    v_sub,
    COALESCE(v_revenue_type, 'free')
  )
  ON CONFLICT (shop_id) DO NOTHING;

  RETURN NEW;
END;
$$;