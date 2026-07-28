-- 1) Vistas públicas expondo apenas colunas seguras (sem stripe_*, notes, launch_date)
CREATE OR REPLACE VIEW public.plans_public
WITH (security_invoker = true) AS
SELECT
  slug, name, description, active, sort_order, color, icon, label,
  visible_on_landing, visible_on_billing, visible_on_checkout, visible_on_compare,
  archived_at, limits, trial_days, supports_multi_shop, included_shops,
  cta_mode, cta_label, cta_url, badge_label,
  show_button, show_price, show_trial, show_badge,
  created_at, updated_at
FROM public.plans;

CREATE OR REPLACE VIEW public.country_settings_public
WITH (security_invoker = true) AS
SELECT
  code, name, flag_emoji, currency, currency_symbol, locale,
  supported_languages, default_language, timezones,
  saas_pro_monthly, saas_pro_yearly, saas_garage_monthly, saas_garage_yearly,
  saas_free_monthly, saas_free_yearly, saas_trial_days,
  inspection_price, inspection_shop_share, inspection_platform_share,
  market_commission_rate, tax_label, active,
  created_at, updated_at
FROM public.country_settings;

-- Garantir que as vistas ficam legíveis por anon/authenticated
GRANT SELECT ON public.plans_public TO anon, authenticated;
GRANT SELECT ON public.country_settings_public TO anon, authenticated;

-- Restaurar SELECT ao role authenticated nas tabelas base (Admin/hooks logados)
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.country_settings TO authenticated;

-- 2) Bloquear get_shop_country_code para anónimos e validar posse do shop
CREATE OR REPLACE FUNCTION public.get_shop_country_code(shop_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  -- Só devolve se o utilizador for membro/dono da oficina
  IF NOT public.user_is_shop_member(shop_id, auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT country_code INTO v_country FROM public.shops WHERE id = shop_id LIMIT 1;
  RETURN v_country;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shop_country_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_country_code(uuid) TO authenticated, service_role;