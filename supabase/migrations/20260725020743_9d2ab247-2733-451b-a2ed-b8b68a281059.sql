
-- 1) buyer_reviews / seller_reviews: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read buyer reviews" ON public.buyer_reviews;
CREATE POLICY "Authenticated can read buyer reviews"
  ON public.buyer_reviews
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read seller reviews" ON public.seller_reviews;
CREATE POLICY "Authenticated can read seller reviews"
  ON public.seller_reviews
  FOR SELECT TO authenticated
  USING (true);

-- 2) carity_seller_profiles: remove anon full-row exposure; expose only safe display fields via a view
DROP POLICY IF EXISTS "Public reads verified seller display fields" ON public.carity_seller_profiles;

CREATE OR REPLACE VIEW public.carity_seller_profiles_public AS
SELECT
  id,
  user_id,
  name,
  location,
  verified,
  account_type,
  country_code,
  dealer_company_name,
  dealer_logo_url,
  dealer_city,
  dealer_slug,
  dealer_description,
  phone,
  created_at
FROM public.carity_seller_profiles
WHERE verified = true;

GRANT SELECT ON public.carity_seller_profiles_public TO anon, authenticated;

-- 3) carity_seller_profiles: restrict ALL-policies to authenticated role
DROP POLICY IF EXISTS "Sellers manage own profile" ON public.carity_seller_profiles;
CREATE POLICY "Sellers manage own profile"
  ON public.carity_seller_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admin manage seller profiles" ON public.carity_seller_profiles;
CREATE POLICY "Super admin manage seller profiles"
  ON public.carity_seller_profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4) demo_requests: replace hardcoded email fallback with role-based checks
DROP POLICY IF EXISTS "Commercial can view demo requests" ON public.demo_requests;
CREATE POLICY "Commercial can view demo requests"
  ON public.demo_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'commercial_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Commercial can update demo requests" ON public.demo_requests;
CREATE POLICY "Commercial can update demo requests"
  ON public.demo_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'commercial_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'commercial_admin'::public.app_role)
  );

-- 5) plan_country_prices: hide Stripe IDs from public; expose safe view
DROP POLICY IF EXISTS "plan_country_prices public read" ON public.plan_country_prices;
CREATE POLICY "plan_country_prices authenticated read"
  ON public.plan_country_prices
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE VIEW public.plan_country_prices_public AS
SELECT
  id,
  plan_slug,
  country_code,
  cycle,
  currency,
  amount,
  active,
  trial_days_override,
  created_at,
  updated_at
FROM public.plan_country_prices
WHERE active = true;

GRANT SELECT ON public.plan_country_prices_public TO anon, authenticated;
