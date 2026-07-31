GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.is_commercial_admin(uuid) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.get_shop_creation_status(uuid) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.get_user_shop_ids(uuid) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.user_is_shop_member(uuid, uuid) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role, supabase_auth_admin;