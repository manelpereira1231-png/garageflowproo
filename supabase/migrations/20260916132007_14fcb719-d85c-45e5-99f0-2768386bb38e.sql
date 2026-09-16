-- 1) Impedir que um utilizador de oficina se torne fornecedor
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

  IF EXISTS (SELECT 1 FROM public.shops s WHERE s.user_id = NEW.owner_user_id AND s.deleted_at IS NULL) THEN
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

DROP TRIGGER IF EXISTS enforce_supplier_not_shop_account_trg ON public.gsn_suppliers;
CREATE TRIGGER enforce_supplier_not_shop_account_trg
  BEFORE INSERT OR UPDATE OF owner_user_id ON public.gsn_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supplier_not_shop_account();

-- 2) Impedir que um fornecedor crie uma oficina
CREATE OR REPLACE FUNCTION public.enforce_shop_not_supplier_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers g
    WHERE g.owner_user_id = NEW.user_id AND g.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta conta é uma conta de fornecedor e não pode criar oficinas. Use uma conta diferente.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_shop_not_supplier_account_trg ON public.shops;
CREATE TRIGGER enforce_shop_not_supplier_account_trg
  BEFORE INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_not_supplier_account();

-- 3) Impedir que um fornecedor seja adicionado à equipa de uma oficina
CREATE OR REPLACE FUNCTION public.enforce_shop_user_not_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers g
    WHERE g.owner_user_id = NEW.user_id AND g.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta conta é uma conta de fornecedor e não pode pertencer a uma oficina.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_shop_user_not_supplier_trg ON public.shop_users;
CREATE TRIGGER enforce_shop_user_not_supplier_trg
  BEFORE INSERT OR UPDATE OF user_id ON public.shop_users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_user_not_supplier();