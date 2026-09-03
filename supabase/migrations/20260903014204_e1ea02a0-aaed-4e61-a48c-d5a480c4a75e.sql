CREATE OR REPLACE FUNCTION public.enforce_primary_shop_undeletable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _oldest uuid;
BEGIN
  -- Demo tenants are disposable by design and are deleted by the protected
  -- sales-demo function when the session ends or expires.
  IF COALESCE(OLD.is_demo, false) THEN
    RETURN OLD;
  END IF;

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