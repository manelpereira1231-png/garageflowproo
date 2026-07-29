
-- 1) country_settings: hide Stripe id columns from anon/authenticated
REVOKE SELECT ON public.country_settings FROM anon, authenticated;
GRANT SELECT (
  code, name, flag_emoji, currency, currency_symbol, locale,
  supported_languages, default_language, timezones,
  saas_pro_monthly, saas_pro_yearly, saas_garage_monthly, saas_garage_yearly,
  saas_free_monthly, saas_free_yearly, saas_trial_days,
  inspection_price, inspection_shop_share, inspection_platform_share,
  market_commission_rate, tax_label, active, launch_date, notes,
  created_at, updated_at
) ON public.country_settings TO anon, authenticated;

-- 2) plan_country_prices: hide Stripe id columns from authenticated
REVOKE SELECT ON public.plan_country_prices FROM anon, authenticated;
GRANT SELECT (
  id, plan_slug, country_code, cycle, currency, amount,
  active, trial_days_override, created_at, updated_at
) ON public.plan_country_prices TO authenticated;

-- 3) plan_promotions: hide Stripe id columns from anon/authenticated
REVOKE SELECT ON public.plan_promotions FROM anon, authenticated;
GRANT SELECT (
  id, country_code, plan, cycle, promo_price, currency,
  active, starts_at, ends_at, notes, created_by, created_at, updated_at
) ON public.plan_promotions TO anon, authenticated;

-- 4) suppliers: hide contact_email/contact_phone from authenticated users
REVOKE SELECT ON public.suppliers FROM anon, authenticated;
GRANT SELECT (
  id, name, discount_percent, integration_active, notes, created_at, updated_at
) ON public.suppliers TO authenticated;
