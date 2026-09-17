CREATE OR REPLACE FUNCTION public.gsn_resolve_my_supplier()
RETURNS TABLE (id uuid, state text, rejection_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _row public.gsn_suppliers%ROWTYPE;
  _is_shop boolean;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT s.* INTO _row
  FROM public.gsn_suppliers s
  WHERE s.owner_user_id = _uid AND s.deleted_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _row.id IS NULL THEN
    SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;
    SELECT EXISTS (SELECT 1 FROM public.shop_users su WHERE su.user_id = _uid) INTO _is_shop;

    IF _email IS NOT NULL AND NOT _is_shop THEN
      SELECT s.* INTO _row
      FROM public.gsn_suppliers s
      WHERE s.deleted_at IS NULL
        AND s.owner_user_id IS NULL
        AND lower(s.email) = lower(_email)
      ORDER BY s.created_at DESC
      LIMIT 1;

      IF _row.id IS NOT NULL THEN
        UPDATE public.gsn_suppliers
        SET owner_user_id = _uid, updated_at = now()
        WHERE public.gsn_suppliers.id = _row.id;
        _row.owner_user_id := _uid;
      END IF;
    END IF;
  END IF;

  IF _row.id IS NULL THEN RETURN; END IF;

  id := _row.id;
  state := _row.state::text;
  rejection_reason := _row.rejection_reason;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.gsn_resolve_my_supplier() FROM public;
GRANT EXECUTE ON FUNCTION public.gsn_resolve_my_supplier() TO authenticated;

UPDATE public.gsn_suppliers s
SET owner_user_id = u.id, updated_at = now()
FROM auth.users u
WHERE s.owner_user_id IS NULL
  AND s.deleted_at IS NULL
  AND lower(s.email) = lower(u.email)
  AND NOT EXISTS (SELECT 1 FROM public.shop_users su WHERE su.user_id = u.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.gsn_suppliers s2
    WHERE s2.owner_user_id = u.id AND s2.deleted_at IS NULL
  );