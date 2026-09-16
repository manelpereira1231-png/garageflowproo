REVOKE ALL ON FUNCTION public.enforce_supplier_not_shop_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_shop_not_supplier_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_shop_user_not_supplier() FROM PUBLIC, anon, authenticated;