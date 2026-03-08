
CREATE OR REPLACE FUNCTION public.get_shop_member_emails(_shop_id uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT su.user_id, au.email::text
  FROM public.shop_users su
  INNER JOIN auth.users au ON au.id = su.user_id
  WHERE su.shop_id = _shop_id
    AND (
      public.user_owns_shop(auth.uid(), _shop_id)
      OR public.user_is_shop_member(auth.uid(), _shop_id)
      OR public.is_super_admin(auth.uid())
    )
$$;
