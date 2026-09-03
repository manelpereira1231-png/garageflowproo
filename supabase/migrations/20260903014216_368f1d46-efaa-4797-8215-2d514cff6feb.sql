REVOKE EXECUTE ON FUNCTION public.enforce_primary_shop_undeletable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_primary_shop_undeletable() TO service_role;