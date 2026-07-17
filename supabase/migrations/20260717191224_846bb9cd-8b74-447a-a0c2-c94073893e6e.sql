-- Fix onboarding exit: shop owners must always have a shop_users owner role.
-- Root cause observed in production: /rpc/current_shop_role returned null for a newly created shop,
-- because public.shops.user_id owned the shop but public.shop_users had no owner row.

CREATE OR REPLACE FUNCTION public.ensure_shop_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.shop_users (shop_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner')
    ON CONFLICT (shop_id, user_id) DO UPDATE
      SET role = CASE
        WHEN public.shop_users.role IS NULL OR public.shop_users.role <> 'owner' THEN 'owner'
        ELSE public.shop_users.role
      END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_shop_owner_membership ON public.shops;
CREATE TRIGGER trg_ensure_shop_owner_membership
AFTER INSERT OR UPDATE OF user_id ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.ensure_shop_owner_membership();

-- Backfill all existing owner shops that are missing the owner membership row.
INSERT INTO public.shop_users (shop_id, user_id, role)
SELECT sh.id, sh.user_id, 'owner'
FROM public.shops sh
WHERE sh.user_id IS NOT NULL
ON CONFLICT (shop_id, user_id) DO UPDATE
  SET role = CASE
    WHEN public.shop_users.role IS NULL OR public.shop_users.role <> 'owner' THEN 'owner'
    ELSE public.shop_users.role
  END;

-- Defensive permission lookup: direct shop owner is always owner, even if legacy data is incomplete.
CREATE OR REPLACE FUNCTION public.current_shop_role(_shop_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = _shop_id
        AND sh.user_id = auth.uid()
    ) THEN 'owner'
    ELSE (
      SELECT su.role
      FROM public.shop_users su
      WHERE su.shop_id = _shop_id
        AND su.user_id = auth.uid()
      LIMIT 1
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.ensure_shop_owner_membership() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_shop_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_shop_role(uuid) TO service_role;