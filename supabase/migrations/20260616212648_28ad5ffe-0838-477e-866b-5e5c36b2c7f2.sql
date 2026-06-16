
-- 1) Drop public token-bypass policies on base tables
DROP POLICY IF EXISTS "Public portal access to work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Public portal access to vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Portal access vehicle_global_history" ON public.vehicle_global_history;
DROP POLICY IF EXISTS "Public shop access for quotes" ON public.shops;
DROP POLICY IF EXISTS "Public vehicle access for quotes" ON public.vehicles;

-- 2a) Block super_admin role escalation via shop_users INSERT/UPDATE
DROP POLICY IF EXISTS "Shop owners manage shop_users" ON public.shop_users;

CREATE POLICY "Shop owners manage shop_users (non-super)"
ON public.shop_users
FOR ALL
TO authenticated
USING (
  (public.user_owns_shop(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  AND role <> 'super_admin'
)
WITH CHECK (
  (public.user_owns_shop(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  AND role <> 'super_admin'
);

CREATE POLICY "Super admins manage super_admin shop_users"
ON public.shop_users
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 2b) Harden is_super_admin: ignore shop_users role; rely on hardcoded email + user_roles
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'manelpereira11@gmail.com'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  );
$$;

-- 2c) Clean up orphan super_admin rows in shop_users
DELETE FROM public.shop_users
WHERE role = 'super_admin'
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'manelpereira11@gmail.com'
  );

-- 3) Restrict carity_seller_profiles anon read to safe columns only
DROP POLICY IF EXISTS "Public read verified sellers" ON public.carity_seller_profiles;

REVOKE SELECT ON public.carity_seller_profiles FROM anon;
GRANT SELECT (
  id, user_id, verified, account_type,
  dealer_company_name, dealer_slug, dealer_city, dealer_logo_url, dealer_description,
  created_at
) ON public.carity_seller_profiles TO anon;

CREATE POLICY "Public reads verified seller display fields"
ON public.carity_seller_profiles
FOR SELECT
TO anon
USING (verified = true);

-- 4) Restrict country_settings anon read to safe columns only
DROP POLICY IF EXISTS "Active countries are publicly readable" ON public.country_settings;
DROP POLICY IF EXISTS "Public reads safe country fields" ON public.country_settings;
DROP POLICY IF EXISTS "Authenticated read active countries" ON public.country_settings;

REVOKE SELECT ON public.country_settings FROM anon;
GRANT SELECT (
  code, name, currency, currency_symbol, locale,
  saas_trial_days, active
) ON public.country_settings TO anon;

CREATE POLICY "Public reads safe country fields"
ON public.country_settings
FOR SELECT
TO anon
USING (active = true);

CREATE POLICY "Authenticated read active countries"
ON public.country_settings
FOR SELECT
TO authenticated
USING (active = true OR public.is_super_admin(auth.uid()));

-- 5) Lock work-order-files bucket to actual shop members
DROP POLICY IF EXISTS "Shop members view work order files" ON storage.objects;
DROP POLICY IF EXISTS "Shop members upload work order files" ON storage.objects;
DROP POLICY IF EXISTS "Shop members delete work order files" ON storage.objects;

CREATE POLICY "Shop members read work order files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.shops WHERE id IN (SELECT public.get_user_shop_ids(auth.uid()))
  )
);

CREATE POLICY "Shop members write work order files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.shops WHERE id IN (SELECT public.get_user_shop_ids(auth.uid()))
  )
);

CREATE POLICY "Shop members delete work order files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.shops WHERE id IN (SELECT public.get_user_shop_ids(auth.uid()))
  )
);

-- 6) Lock market-signatures bucket reads to the signature owner
DROP POLICY IF EXISTS "Authenticated can read signatures" ON storage.objects;

CREATE POLICY "Users read own signatures"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'market-signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Super admins read all signatures"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'market-signatures'
  AND public.is_super_admin(auth.uid())
);
