CREATE OR REPLACE FUNCTION public.enforce_supplier_not_shop_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.shops s WHERE s.user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Esta conta já é uma conta de oficina. Uma conta de fornecedor tem de ser separada da conta de oficina.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shop_users su WHERE su.user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Esta conta pertence a uma equipa de oficina. Uma conta de fornecedor tem de ser separada da conta de oficina.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_supplier_not_shop_account() FROM PUBLIC, anon, authenticated;