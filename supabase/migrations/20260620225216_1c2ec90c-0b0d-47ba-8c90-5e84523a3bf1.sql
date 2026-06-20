
-- 1) carity_seller_profiles: restrict anon to safe display columns only
REVOKE SELECT ON public.carity_seller_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, location, verified, country_code, account_type,
  dealer_company_name, dealer_logo_url, dealer_slug, dealer_city,
  dealer_plan, dealer_description, dealer_active_until,
  dealer_subscription_status,
  stripe_connect_charges_enabled, stripe_connect_payouts_enabled,
  stripe_connect_onboarded, created_at
) ON public.carity_seller_profiles TO anon;

-- 2) country_settings: restrict anon + authenticated to safe non-Stripe columns
REVOKE SELECT ON public.country_settings FROM anon, authenticated;
GRANT SELECT (
  code, name, flag_emoji, currency, currency_symbol, locale,
  supported_languages, default_language, timezones,
  saas_pro_monthly, saas_pro_yearly, saas_garage_monthly, saas_garage_yearly,
  saas_trial_days, inspection_price, inspection_shop_share, inspection_platform_share,
  market_commission_rate, tax_label, active, launch_date, created_at, updated_at
) ON public.country_settings TO anon, authenticated;
GRANT ALL ON public.country_settings TO service_role;

-- 3) listing_views: drop public select user_id exposure; allow only safe aggregate columns
REVOKE SELECT ON public.listing_views FROM anon, authenticated;
GRANT SELECT (id, listing_id, viewed_date, created_at) ON public.listing_views TO anon, authenticated;
GRANT ALL ON public.listing_views TO service_role;

-- 4) carity-photos bucket: enforce ownership on UPDATE/DELETE
DROP POLICY IF EXISTS "Users delete own carity photos" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own carity photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload carity photos" ON storage.objects;

CREATE POLICY "Authenticated users upload own carity photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'carity-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own carity photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'carity-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'carity-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own carity photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'carity-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5) shop-logos bucket: enforce shop membership on INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete logos" ON storage.objects;

CREATE POLICY "Shop members upload shop logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT get_user_shop_ids(auth.uid())::text
    )
  );

CREATE POLICY "Shop members update shop logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT get_user_shop_ids(auth.uid())::text
    )
  )
  WITH CHECK (
    bucket_id = 'shop-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT get_user_shop_ids(auth.uid())::text
    )
  );

CREATE POLICY "Shop members delete shop logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shop-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT get_user_shop_ids(auth.uid())::text
    )
  );
