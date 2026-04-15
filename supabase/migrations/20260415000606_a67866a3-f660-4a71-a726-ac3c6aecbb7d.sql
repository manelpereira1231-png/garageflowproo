
CREATE OR REPLACE FUNCTION public.get_seller_emails(seller_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id AS user_id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(seller_ids);
$$;
