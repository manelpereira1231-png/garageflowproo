GRANT EXECUTE ON FUNCTION public.touch_user_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_shop_ids(uuid) TO anon;