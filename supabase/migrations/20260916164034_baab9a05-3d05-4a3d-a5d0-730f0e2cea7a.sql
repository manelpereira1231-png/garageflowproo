-- 1) Views: run with the caller's permissions instead of the creator's.
ALTER VIEW public.plans_public SET (security_invoker = true);
ALTER VIEW public.plan_country_prices_public SET (security_invoker = true);
ALTER VIEW public.plan_promotions_public SET (security_invoker = true);

-- Base tables keep RLS; expose only the public catalogue columns/rows.
REVOKE SELECT ON public.plans FROM anon, authenticated;
REVOKE SELECT ON public.plan_country_prices FROM anon, authenticated;
REVOKE SELECT ON public.plan_promotions FROM anon, authenticated;

GRANT SELECT (slug, name, description, active, sort_order, color, icon, label,
  visible_on_landing, visible_on_billing, visible_on_checkout, visible_on_compare,
  archived_at, limits, trial_days, supports_multi_shop, included_shops,
  cta_mode, cta_label, cta_url, badge_label, show_button, show_price, show_trial,
  show_badge, created_at, updated_at)
  ON public.plans TO anon, authenticated;

GRANT SELECT (id, plan_slug, country_code, cycle, currency, amount, active,
  trial_days_override, created_at, updated_at)
  ON public.plan_country_prices TO anon, authenticated;

GRANT SELECT (id, country_code, plan, cycle, promo_price, currency, active,
  starts_at, ends_at, notes, created_at, updated_at)
  ON public.plan_promotions TO anon, authenticated;

DROP POLICY IF EXISTS plans_public_read ON public.plans;
CREATE POLICY plans_public_read ON public.plans FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS plan_country_prices_public_read ON public.plan_country_prices;
CREATE POLICY plan_country_prices_public_read ON public.plan_country_prices
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS plan_promotions_public_read ON public.plan_promotions;
CREATE POLICY plan_promotions_public_read ON public.plan_promotions
  FOR SELECT TO anon, authenticated USING (active = true);

-- 2) gsn_suppliers: column-level exposure per role.
REVOKE SELECT ON public.gsn_suppliers FROM anon, authenticated;

-- Anonymous visitors: storefront/directory basics only.
GRANT SELECT (id, slug, company_name, trade_name, logo_url, banner_url, description,
  website, city, district, country, average_delivery_time, minimum_order,
  pickup_available, delivery_available, rating_average, rating_count,
  active, approved, suspended, deleted_at, created_at)
  ON public.gsn_suppliers TO anon;

-- Signed-in users: the above plus business contact details (no payout/commission/KYC data).
GRANT SELECT (id, owner_user_id, slug, company_name, trade_name, logo_url, banner_url,
  description, website, email, phone, support_email, support_phone, address, postal_code,
  city, district, country, average_delivery_time, minimum_order,
  pickup_available, delivery_available, rating_average, rating_count,
  active, approved, suspended, state, rejection_reason, deleted_at, created_at, updated_at)
  ON public.gsn_suppliers TO authenticated;

-- Owner / super admin need the full row: served through security-definer RPCs.
CREATE OR REPLACE FUNCTION public.gsn_my_supplier()
RETURNS SETOF public.gsn_suppliers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.gsn_suppliers
  WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ORDER BY created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.gsn_admin_suppliers(_id uuid DEFAULT NULL)
RETURNS SETOF public.gsn_suppliers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.* FROM public.gsn_suppliers s
  WHERE has_role(auth.uid(), 'super_admin'::app_role)
    AND (_id IS NULL OR s.id = _id)
  ORDER BY s.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.gsn_my_supplier() FROM public;
REVOKE ALL ON FUNCTION public.gsn_admin_suppliers(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.gsn_my_supplier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsn_admin_suppliers(uuid) TO authenticated;