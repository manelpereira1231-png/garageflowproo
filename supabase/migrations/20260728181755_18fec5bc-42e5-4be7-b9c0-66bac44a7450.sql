DROP VIEW IF EXISTS public.country_settings_public;
CREATE VIEW public.country_settings_public
WITH (security_invoker = true) AS
SELECT
  code, name, flag_emoji, currency, currency_symbol, locale,
  supported_languages, default_language, timezones,
  saas_pro_monthly, saas_pro_yearly, saas_garage_monthly, saas_garage_yearly,
  saas_free_monthly, saas_free_yearly, saas_trial_days,
  inspection_price, inspection_shop_share, inspection_platform_share,
  market_commission_rate, tax_label, active
FROM public.country_settings;
GRANT SELECT ON public.country_settings_public TO anon, authenticated;

DROP VIEW IF EXISTS public.plans_public;
CREATE VIEW public.plans_public
WITH (security_invoker = true) AS
SELECT
  slug, name, description, active, sort_order, color, icon, label,
  visible_on_landing, visible_on_billing, visible_on_checkout, visible_on_compare,
  archived_at, limits, trial_days, supports_multi_shop, included_shops,
  cta_mode, cta_label, cta_url, badge_label,
  show_button, show_price, show_trial, show_badge,
  created_at, updated_at
FROM public.plans;
GRANT SELECT ON public.plans_public TO anon, authenticated;