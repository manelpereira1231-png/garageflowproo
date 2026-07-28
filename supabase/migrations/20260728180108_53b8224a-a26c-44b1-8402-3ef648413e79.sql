
-- 1) RPC segura para o frontend obter só o country_code de uma shop
CREATE OR REPLACE FUNCTION public.get_shop_country_code(shop_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT country_code FROM public.shops WHERE id = shop_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shop_country_code(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shop_country_code(uuid) TO anon, authenticated, service_role;

-- 2) Anon = apenas leitura nas tabelas expostas à landing
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  public.features,
  public.plans,
  public.plan_features,
  public.plan_country_prices,
  public.country_settings,
  public.platform_settings,
  public.plan_promotions,
  public.system_feature_flags
FROM anon;

-- 3) Anon perde SELECT em plan_country_prices (usa a view *_public)
REVOKE SELECT ON public.plan_country_prices FROM anon;

-- 4) Column-level: esconder a anon colunas internas (Stripe/notas/etc.)
REVOKE SELECT ON public.country_settings FROM anon;
GRANT SELECT (
  code, name, flag_emoji, currency, currency_symbol, locale,
  supported_languages, default_language, timezones,
  saas_pro_monthly, saas_pro_yearly, saas_garage_monthly, saas_garage_yearly,
  saas_free_monthly, saas_free_yearly, saas_trial_days,
  inspection_price, inspection_shop_share, inspection_platform_share,
  market_commission_rate, tax_label, active
) ON public.country_settings TO anon;

REVOKE SELECT ON public.plan_promotions FROM anon;
GRANT SELECT (
  id, country_code, plan, cycle, promo_price, currency,
  active, starts_at, ends_at
) ON public.plan_promotions TO anon;

REVOKE SELECT ON public.plans FROM anon;
GRANT SELECT (
  slug, name, description, active, sort_order, color, icon, label,
  visible_on_landing, visible_on_billing, visible_on_checkout, visible_on_compare,
  archived_at, limits, trial_days, supports_multi_shop, included_shops,
  cta_mode, cta_label, cta_url, badge_label,
  show_button, show_price, show_trial, show_badge,
  created_at, updated_at
) ON public.plans TO anon;
