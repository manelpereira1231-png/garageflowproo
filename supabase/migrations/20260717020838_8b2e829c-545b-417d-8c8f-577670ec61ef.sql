
-- =========================================================
-- FASE 1: SCHEMA DINÂMICO
-- =========================================================

-- 1a. Extend `plans` with visual + visibility metadata
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS visible_on_landing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_on_billing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_on_checkout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_on_compare boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 1b. Extend `features` (icon + ordering — description/category already exist)
ALTER TABLE public.features
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- 1c. New table: plan_country_prices
CREATE TABLE IF NOT EXISTS public.plan_country_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_slug text NOT NULL REFERENCES public.plans(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.country_settings(code) ON UPDATE CASCADE ON DELETE CASCADE,
  cycle text NOT NULL CHECK (cycle IN ('monthly','yearly','quarterly','semestral','lifetime')),
  currency text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  stripe_product_id text,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_slug, country_code, cycle)
);

GRANT SELECT ON public.plan_country_prices TO anon, authenticated;
GRANT ALL ON public.plan_country_prices TO service_role;

ALTER TABLE public.plan_country_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_country_prices public read"
  ON public.plan_country_prices
  FOR SELECT
  USING (true);

CREATE POLICY "plan_country_prices super admin manage"
  ON public.plan_country_prices
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Reuse existing updated_at helper
DROP TRIGGER IF EXISTS trg_plan_country_prices_updated_at ON public.plan_country_prices;
CREATE TRIGGER trg_plan_country_prices_updated_at
  BEFORE UPDATE ON public.plan_country_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- BACKFILL: copy hardcoded country_settings columns → plan_country_prices
-- (idempotent — ON CONFLICT DO UPDATE preserves any manual override)
-- =========================================================
INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
SELECT 'free', cs.code, 'monthly', cs.currency, cs.saas_free_monthly, cs.stripe_free_product_id, cs.stripe_free_monthly
  FROM public.country_settings cs
ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
  SET amount = EXCLUDED.amount,
      currency = EXCLUDED.currency,
      stripe_product_id = COALESCE(public.plan_country_prices.stripe_product_id, EXCLUDED.stripe_product_id),
      stripe_price_id = COALESCE(public.plan_country_prices.stripe_price_id, EXCLUDED.stripe_price_id);

INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
SELECT 'free', cs.code, 'yearly', cs.currency, cs.saas_free_yearly, cs.stripe_free_product_id, cs.stripe_free_yearly
  FROM public.country_settings cs
ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
  SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
      stripe_product_id = COALESCE(public.plan_country_prices.stripe_product_id, EXCLUDED.stripe_product_id),
      stripe_price_id = COALESCE(public.plan_country_prices.stripe_price_id, EXCLUDED.stripe_price_id);

INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
SELECT 'pro', cs.code, 'monthly', cs.currency, cs.saas_pro_monthly, cs.stripe_pro_product_id, cs.stripe_pro_monthly
  FROM public.country_settings cs
ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
  SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
      stripe_product_id = COALESCE(public.plan_country_prices.stripe_product_id, EXCLUDED.stripe_product_id),
      stripe_price_id = COALESCE(public.plan_country_prices.stripe_price_id, EXCLUDED.stripe_price_id);

INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
SELECT 'pro', cs.code, 'yearly', cs.currency, cs.saas_pro_yearly, cs.stripe_pro_product_id, cs.stripe_pro_yearly
  FROM public.country_settings cs
ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
  SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
      stripe_product_id = COALESCE(public.plan_country_prices.stripe_product_id, EXCLUDED.stripe_product_id),
      stripe_price_id = COALESCE(public.plan_country_prices.stripe_price_id, EXCLUDED.stripe_price_id);

INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
SELECT 'garage', cs.code, 'monthly', cs.currency, cs.saas_garage_monthly, cs.stripe_garage_product_id, cs.stripe_garage_monthly
  FROM public.country_settings cs
ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
  SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
      stripe_product_id = COALESCE(public.plan_country_prices.stripe_product_id, EXCLUDED.stripe_product_id),
      stripe_price_id = COALESCE(public.plan_country_prices.stripe_price_id, EXCLUDED.stripe_price_id);

INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
SELECT 'garage', cs.code, 'yearly', cs.currency, cs.saas_garage_yearly, cs.stripe_garage_product_id, cs.stripe_garage_yearly
  FROM public.country_settings cs
ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
  SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
      stripe_product_id = COALESCE(public.plan_country_prices.stripe_product_id, EXCLUDED.stripe_product_id),
      stripe_price_id = COALESCE(public.plan_country_prices.stripe_price_id, EXCLUDED.stripe_price_id);

-- =========================================================
-- BACKWARD-COMPAT TRIGGER: mirror country_settings.saas_*/stripe_* -> plan_country_prices
-- (legacy admin UI still writes to old columns; keep new table in sync)
-- =========================================================
CREATE OR REPLACE FUNCTION public.mirror_country_settings_to_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- free monthly
  INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
  VALUES ('free', NEW.code, 'monthly', NEW.currency, NEW.saas_free_monthly, NEW.stripe_free_product_id, NEW.stripe_free_monthly)
  ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
    SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
        stripe_product_id = EXCLUDED.stripe_product_id, stripe_price_id = EXCLUDED.stripe_price_id;

  INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
  VALUES ('free', NEW.code, 'yearly', NEW.currency, NEW.saas_free_yearly, NEW.stripe_free_product_id, NEW.stripe_free_yearly)
  ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
    SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
        stripe_product_id = EXCLUDED.stripe_product_id, stripe_price_id = EXCLUDED.stripe_price_id;

  INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
  VALUES ('pro', NEW.code, 'monthly', NEW.currency, NEW.saas_pro_monthly, NEW.stripe_pro_product_id, NEW.stripe_pro_monthly)
  ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
    SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
        stripe_product_id = EXCLUDED.stripe_product_id, stripe_price_id = EXCLUDED.stripe_price_id;

  INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
  VALUES ('pro', NEW.code, 'yearly', NEW.currency, NEW.saas_pro_yearly, NEW.stripe_pro_product_id, NEW.stripe_pro_yearly)
  ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
    SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
        stripe_product_id = EXCLUDED.stripe_product_id, stripe_price_id = EXCLUDED.stripe_price_id;

  INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
  VALUES ('garage', NEW.code, 'monthly', NEW.currency, NEW.saas_garage_monthly, NEW.stripe_garage_product_id, NEW.stripe_garage_monthly)
  ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
    SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
        stripe_product_id = EXCLUDED.stripe_product_id, stripe_price_id = EXCLUDED.stripe_price_id;

  INSERT INTO public.plan_country_prices (plan_slug, country_code, cycle, currency, amount, stripe_product_id, stripe_price_id)
  VALUES ('garage', NEW.code, 'yearly', NEW.currency, NEW.saas_garage_yearly, NEW.stripe_garage_product_id, NEW.stripe_garage_yearly)
  ON CONFLICT (plan_slug, country_code, cycle) DO UPDATE
    SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
        stripe_product_id = EXCLUDED.stripe_product_id, stripe_price_id = EXCLUDED.stripe_price_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_country_settings_prices ON public.country_settings;
CREATE TRIGGER trg_mirror_country_settings_prices
  AFTER INSERT OR UPDATE ON public.country_settings
  FOR EACH ROW EXECUTE FUNCTION public.mirror_country_settings_to_prices();

-- =========================================================
-- FASE 2: RPC unificado para preço efetivo (base + promoção)
-- =========================================================
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
  )
  SELECT
    b.plan_slug,
    b.country_code,
    b.cycle,
    b.currency,
    b.amount AS base_amount,
    b.stripe_price_id AS base_stripe_price_id,
    b.stripe_product_id AS base_stripe_product_id,
    COALESCE(pr.promo_price, b.amount) AS effective_amount,
    COALESCE(pr.promo_price_id, b.stripe_price_id) AS effective_stripe_price_id,
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

-- Seed sane defaults for visual metadata on existing plans (no visual change — just fills nulls)
UPDATE public.plans SET color = '#22c55e', icon = 'Rocket'      WHERE slug = 'free'   AND color IS NULL;
UPDATE public.plans SET color = '#f59e0b', icon = 'Zap',   label = 'Mais Popular' WHERE slug = 'pro'    AND color IS NULL;
UPDATE public.plans SET color = '#8b5cf6', icon = 'Crown' WHERE slug = 'garage' AND color IS NULL;
