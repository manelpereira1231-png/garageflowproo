
CREATE TABLE public.plan_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('free', 'pro', 'garage')),
  cycle text NOT NULL CHECK (cycle IN ('monthly', 'yearly')),
  promo_price numeric NOT NULL CHECK (promo_price >= 0),
  currency text NOT NULL,
  stripe_price_id text,
  stripe_product_id text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, plan, cycle)
);

GRANT SELECT ON public.plan_promotions TO anon, authenticated;
GRANT ALL ON public.plan_promotions TO service_role;

ALTER TABLE public.plan_promotions ENABLE ROW LEVEL SECURITY;

-- Public read: landing/billing/checkout precisam de ver as promoções ativas
-- e mostrar preços consistentes em toda a plataforma. Só é exposta a promoção
-- em si (preço/datas), nunca dados sensíveis.
CREATE POLICY "Anyone can view plan promotions"
  ON public.plan_promotions FOR SELECT
  USING (true);

-- Only super admins can mutate. Escrita real acontece via Edge Function
-- (service_role), mas mantemos a política para consistência.
CREATE POLICY "Super admin manage plan promotions"
  ON public.plan_promotions FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER plan_promotions_set_updated_at
  BEFORE UPDATE ON public.plan_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX plan_promotions_country_active_idx
  ON public.plan_promotions (country_code, active)
  WHERE active = true;

-- Helper function: returns effective promo for a given country/plan/cycle at now(),
-- respecting active flag + optional start/end window. Used server-side by
-- create-checkout and any other flow that needs the authoritative price.
CREATE OR REPLACE FUNCTION public.get_active_promotion(
  _country_code text,
  _plan text,
  _cycle text
)
RETURNS TABLE (
  promo_price numeric,
  stripe_price_id text,
  discount_percent integer,
  ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.promo_price,
    p.stripe_price_id,
    CASE
      WHEN COALESCE(cs_base.base_amount, 0) > 0
        THEN GREATEST(0, ROUND(((cs_base.base_amount - p.promo_price) / cs_base.base_amount) * 100)::int)
      ELSE 0
    END AS discount_percent,
    p.ends_at
  FROM public.plan_promotions p
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN _plan = 'free'   AND _cycle = 'monthly' THEN cs.saas_free_monthly
        WHEN _plan = 'free'   AND _cycle = 'yearly'  THEN cs.saas_free_yearly
        WHEN _plan = 'pro'    AND _cycle = 'monthly' THEN cs.saas_pro_monthly
        WHEN _plan = 'pro'    AND _cycle = 'yearly'  THEN cs.saas_pro_yearly
        WHEN _plan = 'garage' AND _cycle = 'monthly' THEN cs.saas_garage_monthly
        WHEN _plan = 'garage' AND _cycle = 'yearly'  THEN cs.saas_garage_yearly
      END AS base_amount
    FROM public.country_settings cs
    WHERE cs.code = _country_code
    LIMIT 1
  ) cs_base ON true
  WHERE p.country_code = _country_code
    AND p.plan = _plan
    AND p.cycle = _cycle
    AND p.active = true
    AND (p.starts_at IS NULL OR p.starts_at <= now())
    AND (p.ends_at IS NULL OR p.ends_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_promotion(text, text, text) TO anon, authenticated, service_role;
