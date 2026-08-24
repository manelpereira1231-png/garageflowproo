-- Labels possíveis do utilizador autenticado dentro da oficina (nome de perfil, email, parte local do email)
CREATE OR REPLACE FUNCTION public.my_technician_labels(_shop_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(trim(x))), ARRAY[]::text[])
  FROM (
    SELECT p.name AS x
      FROM public.shop_users su
      LEFT JOIN public.shop_user_profiles p ON p.shop_user_id = su.id
     WHERE su.shop_id = _shop_id AND su.user_id = auth.uid()
    UNION ALL
    SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
    UNION ALL
    SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = auth.uid()
  ) t
  WHERE COALESCE(trim(x), '') <> ''
$$;

-- true quando o utilizador NÃO é técnico da oficina (donos/admins/gestores/receção/super admin)
CREATE OR REPLACE FUNCTION public.is_shop_technician(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users su
     WHERE su.shop_id = _shop_id
       AND su.user_id = auth.uid()
       AND su.role = 'technician'
  ) AND NOT public.is_super_admin(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_access_work_order(_shop_id uuid, _technician text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_shop_technician(_shop_id) THEN true
    WHEN COALESCE(trim(_technician), '') = '' THEN true
    ELSE lower(trim(_technician)) = ANY (public.my_technician_labels(_shop_id))
  END
$$;

GRANT EXECUTE ON FUNCTION public.my_technician_labels(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_technician(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_work_order(uuid, text) TO authenticated;

DROP POLICY IF EXISTS work_orders_technician_scope ON public.work_orders;
CREATE POLICY work_orders_technician_scope
ON public.work_orders
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.can_access_work_order(shop_id, technician))
WITH CHECK (public.can_access_work_order(shop_id, technician));