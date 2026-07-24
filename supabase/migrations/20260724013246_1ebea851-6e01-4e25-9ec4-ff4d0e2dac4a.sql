
-- 1) Fix mutable search_path on pgmq wrapper functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = pgmq, public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = pgmq, public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = pgmq, public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pgmq, public;

-- 2) Revoke Stripe identifier column reads from anon / authenticated
REVOKE SELECT (stripe_product_id) ON public.plans FROM anon, authenticated;
REVOKE SELECT (stripe_price_id, stripe_product_id, stripe_coupon_id) ON public.plan_country_prices FROM anon, authenticated;
REVOKE SELECT (stripe_price_id) ON public.plan_promotions FROM anon, authenticated;

-- Re-grant SELECT on the remaining columns so PostgREST select=* keeps working
DO $$
DECLARE
  col text;
BEGIN
  -- plans: grant SELECT on every column except stripe_product_id
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plans'
      AND column_name NOT IN ('stripe_product_id')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.plans TO anon, authenticated', col);
  END LOOP;

  -- plan_country_prices: exclude stripe_* columns
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plan_country_prices'
      AND column_name NOT IN ('stripe_price_id','stripe_product_id','stripe_coupon_id')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.plan_country_prices TO anon, authenticated', col);
  END LOOP;

  -- plan_promotions: exclude stripe_price_id
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plan_promotions'
      AND column_name NOT IN ('stripe_price_id')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.plan_promotions TO anon, authenticated', col);
  END LOOP;
END $$;

-- 3) Suppliers: hide contact info cross-tenant
REVOKE SELECT (contact_email, contact_phone) ON public.suppliers FROM anon, authenticated;

DO $$
DECLARE
  col text;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers'
      AND column_name NOT IN ('contact_email','contact_phone')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.suppliers TO anon, authenticated', col);
  END LOOP;
END $$;

-- 4) Harden the effective-price RPC: never leak stripe ids to non-admins
CREATE OR REPLACE FUNCTION public.get_effective_plan_price(
  p_plan_slug text,
  p_country_code text,
  p_cycle text
)
RETURNS TABLE (
  plan_slug text,
  country_code text,
  cycle text,
  currency text,
  base_amount numeric,
  base_stripe_price_id text,
  base_stripe_product_id text,
  effective_amount numeric,
  effective_stripe_price_id text,
  promo_active boolean,
  promo_starts_at timestamptz,
  promo_ends_at timestamptz,
  discount_percent integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.plan_slug, p.country_code, p.cycle, p.currency, p.amount, p.stripe_price_id, p.stripe_product_id
    FROM public.plan_country_prices p
    WHERE p.plan_slug = p_plan_slug
      AND p.country_code = p_country_code
      AND p.cycle = p_cycle
      AND p.active = true
    LIMIT 1
  ),
  promo AS (
    SELECT pp.promo_price, pp.stripe_price_id AS promo_price_id, pp.starts_at, pp.ends_at
    FROM public.plan_promotions pp
    WHERE pp.plan = p_plan_slug
      AND pp.country_code = p_country_code
      AND pp.cycle = p_cycle
      AND pp.active = true
      AND (pp.starts_at IS NULL OR pp.starts_at <= now())
      AND (pp.ends_at IS NULL OR pp.ends_at > now())
    ORDER BY pp.starts_at DESC NULLS LAST
    LIMIT 1
  ),
  is_admin AS (
    SELECT (auth.role() = 'service_role'
            OR public.is_super_admin(auth.uid())) AS ok
  )
  SELECT
    b.plan_slug,
    b.country_code,
    b.cycle,
    b.currency,
    b.amount AS base_amount,
    CASE WHEN (SELECT ok FROM is_admin) THEN b.stripe_price_id ELSE NULL END AS base_stripe_price_id,
    CASE WHEN (SELECT ok FROM is_admin) THEN b.stripe_product_id ELSE NULL END AS base_stripe_product_id,
    COALESCE(pr.promo_price, b.amount) AS effective_amount,
    CASE WHEN (SELECT ok FROM is_admin) THEN COALESCE(pr.promo_price_id, b.stripe_price_id) ELSE NULL END AS effective_stripe_price_id,
    (pr.promo_price IS NOT NULL) AS promo_active,
    pr.starts_at AS promo_starts_at,
    pr.ends_at AS promo_ends_at,
    CASE
      WHEN pr.promo_price IS NULL OR b.amount IS NULL OR b.amount = 0 THEN 0
      ELSE GREATEST(0, LEAST(100, ROUND(((b.amount - pr.promo_price) / b.amount) * 100)::int))
    END AS discount_percent
  FROM base b
  LEFT JOIN promo pr ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_plan_price(text, text, text) TO anon, authenticated, service_role;

-- 5) Admin-only RPCs to read Stripe identifiers (for the admin UI)
CREATE OR REPLACE FUNCTION public.admin_list_plan_country_prices()
RETURNS SETOF public.plan_country_prices
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.plan_country_prices;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_plan_country_prices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_plan_country_prices() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_promotion(
  p_country_code text,
  p_plan text,
  p_cycle text
)
RETURNS TABLE (
  promo_price numeric,
  active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  stripe_price_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT pp.promo_price, pp.active, pp.starts_at, pp.ends_at, pp.stripe_price_id
    FROM public.plan_promotions pp
    WHERE pp.country_code = p_country_code
      AND pp.plan = p_plan
      AND pp.cycle = p_cycle
    LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_promotion(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_promotion(text, text, text) TO authenticated, service_role;
