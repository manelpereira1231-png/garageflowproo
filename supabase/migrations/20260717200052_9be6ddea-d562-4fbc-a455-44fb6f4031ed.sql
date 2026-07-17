CREATE OR REPLACE FUNCTION public.get_shop_creation_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_owner uuid := _user_id;
  v_current int := 0;
  v_plan text;
  v_max int := 1;
BEGIN
  -- Resolve the canonical group owner. For a mother account this is the user id;
  -- for defensive/legacy calls from a shop owner row, use that shop's group owner.
  SELECT COALESCE(
    (SELECT sh.group_owner_id
     FROM public.shops sh
     WHERE sh.group_owner_id = _user_id
     ORDER BY sh.created_at ASC
     LIMIT 1),
    (SELECT sh.group_owner_id
     FROM public.shops sh
     WHERE sh.user_id = _user_id
     ORDER BY sh.created_at ASC
     LIMIT 1),
    _user_id
  )
  INTO v_group_owner;

  SELECT COUNT(*)
  INTO v_current
  FROM public.shops sh
  WHERE sh.group_owner_id = v_group_owner;

  -- Dynamic source of truth: choose the active/trialing subscription in the group
  -- whose plan grants the highest max_shops limit. No fixed plan slugs.
  SELECT s.plan,
         COALESCE((p.limits->>'max_shops')::int, 1)
  INTO v_plan, v_max
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  JOIN public.plans p ON p.slug = s.plan
  WHERE p.active = true
    AND s.status IN ('active', 'trialing')
    AND (sh.group_owner_id = v_group_owner OR sh.user_id = v_group_owner)
  ORDER BY
    CASE
      WHEN COALESCE((p.limits->>'max_shops')::int, 1) < 0 THEN 2147483647
      ELSE COALESCE((p.limits->>'max_shops')::int, 1)
    END DESC,
    p.sort_order DESC NULLS LAST,
    s.created_at DESC
  LIMIT 1;

  IF v_plan IS NULL THEN
    v_plan := public.get_default_plan_slug();
    SELECT COALESCE((p.limits->>'max_shops')::int, 1)
    INTO v_max
    FROM public.plans p
    WHERE p.slug = v_plan;
  END IF;

  IF v_max IS NULL THEN
    v_max := 1;
  END IF;

  RETURN jsonb_build_object(
    'allowed', (v_max < 0) OR (v_current < v_max),
    'current', v_current,
    'max', v_max,
    'plan', v_plan,
    'group_owner_id', v_group_owner
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

CREATE OR REPLACE FUNCTION public.enforce_shop_creation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status jsonb;
  v_group_owner uuid;
  v_is_super boolean := false;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT public.is_super_admin(auth.uid()) INTO v_is_super;
  EXCEPTION WHEN OTHERS THEN
    v_is_super := false;
  END;

  IF v_is_super THEN
    RETURN NEW;
  END IF;

  v_group_owner := COALESCE(NEW.group_owner_id, NEW.user_id);
  v_status := public.get_shop_creation_status(v_group_owner);

  IF NOT COALESCE((v_status->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_LIMIT_REACHED: max % oficinas atingido no plano %',
      v_status->>'max', v_status->>'plan'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_creation_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_shop_creation_limit(uuid) TO authenticated, service_role;