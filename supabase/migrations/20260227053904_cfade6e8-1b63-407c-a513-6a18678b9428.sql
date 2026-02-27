
-- Fix is_super_admin to check email directly from auth.users
-- This ensures Super Admin access even without shop_users entries
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Check hardcoded super admin email first
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'manelpereira11@gmail.com'
  ) OR EXISTS (
    -- Fallback: check shop_users role
    SELECT 1 FROM public.shop_users
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Enable realtime on shops table
ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
