
-- 1) Group ownership model
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS group_owner_id uuid,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Backfill: preserve current behavior (each shop's group_owner_id equals its user_id).
UPDATE public.shops
SET group_owner_id = user_id
WHERE group_owner_id IS NULL;

ALTER TABLE public.shops
  ALTER COLUMN group_owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shops_group_owner_id ON public.shops(group_owner_id);

-- 2) Helper predicate
CREATE OR REPLACE FUNCTION public.is_group_owner(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id
      AND group_owner_id = auth.uid()
  );
$$;

-- 3) RLS: allow the group owner (Oficina Mãe) to see/manage every shop in the group
DROP POLICY IF EXISTS "Group owner manages group shops" ON public.shops;
CREATE POLICY "Group owner manages group shops"
ON public.shops
FOR ALL
TO authenticated
USING (group_owner_id = auth.uid())
WITH CHECK (group_owner_id = auth.uid());

-- 4) Update helper functions to scope by group_owner_id
CREATE OR REPLACE FUNCTION public.get_shop_creation_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current int := 0;
  v_plan text;
  v_max int := 1;
BEGIN
  SELECT COUNT(*)
  INTO v_current
  FROM public.shops
  WHERE group_owner_id = _user_id;

  SELECT s.plan
  INTO v_plan
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  JOIN public.plans p ON p.slug = s.plan
  WHERE sh.group_owner_id = _user_id
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
$function$;

-- 5) delete_child_shop now authorises the caller as the group owner
CREATE OR REPLACE FUNCTION public.delete_child_shop(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _group_owner uuid;
  _oldest uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT group_owner_id INTO _group_owner FROM public.shops WHERE id = _shop_id;
  IF _group_owner IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE='no_data_found';
  END IF;

  IF _group_owner <> _uid AND NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'NOT_SHOP_OWNER' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT id INTO _oldest
  FROM public.shops
  WHERE group_owner_id = _group_owner
  ORDER BY created_at ASC
  LIMIT 1;

  IF _oldest = _shop_id THEN
    RAISE EXCEPTION 'PRIMARY_SHOP_UNDELETABLE'
      USING ERRCODE='check_violation',
            HINT='A Oficina Mãe não pode ser eliminada.';
  END IF;

  DELETE FROM public.campaigns             WHERE shop_id = _shop_id;
  DELETE FROM public.carity_inspection_reports WHERE shop_id = _shop_id;
  DELETE FROM public.carity_inspections    WHERE shop_id = _shop_id;
  DELETE FROM public.carity_inspection_offers WHERE shop_id = _shop_id;
  DELETE FROM public.carity_listings       WHERE shop_id = _shop_id;
  DELETE FROM public.carity_transactions   WHERE shop_id = _shop_id;
  DELETE FROM public.loyalty_transactions  WHERE shop_id = _shop_id;
  DELETE FROM public.loyalty_points        WHERE shop_id = _shop_id;
  DELETE FROM public.parts_orders          WHERE shop_id = _shop_id;
  DELETE FROM public.partner_commissions   WHERE shop_id = _shop_id;
  DELETE FROM public.partner_invites       WHERE shop_id = _shop_id;
  DELETE FROM public.supplier_invites      WHERE shop_id = _shop_id;
  DELETE FROM public.shop_users            WHERE shop_id = _shop_id;
  DELETE FROM public.shops                 WHERE id = _shop_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- 6) enforce_primary_shop_undeletable: scope by group_owner_id
CREATE OR REPLACE FUNCTION public.enforce_primary_shop_undeletable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _oldest uuid;
BEGIN
  SELECT id INTO _oldest
  FROM public.shops
  WHERE group_owner_id = OLD.group_owner_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _oldest = OLD.id THEN
    RAISE EXCEPTION 'PRIMARY_SHOP_UNDELETABLE'
      USING ERRCODE='check_violation',
            HINT='A Oficina Mãe não pode ser eliminada.';
  END IF;
  RETURN OLD;
END;
$function$;

-- 7) Trigger to keep group_owner_id in sync on INSERT: if not provided, default to user_id
CREATE OR REPLACE FUNCTION public.set_default_group_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.group_owner_id IS NULL THEN
    NEW.group_owner_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_default_group_owner ON public.shops;
CREATE TRIGGER trg_set_default_group_owner
BEFORE INSERT ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.set_default_group_owner();
