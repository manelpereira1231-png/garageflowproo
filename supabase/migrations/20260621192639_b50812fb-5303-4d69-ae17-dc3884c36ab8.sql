
-- 1) Add product-id columns to country_settings (one product per plan, per country)
ALTER TABLE public.country_settings
  ADD COLUMN IF NOT EXISTS stripe_pro_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_garage_product_id text;

-- 2) Audit table — keeps full history of price changes so legacy Stripe Price
--    IDs stay traceable. Old Stripe Prices are NEVER deleted (legacy clients
--    keep their original subscription price).
CREATE TABLE IF NOT EXISTS public.plan_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  plan text NOT NULL,                -- 'pro' | 'garage'
  cycle text NOT NULL,               -- 'monthly' | 'yearly'
  currency text NOT NULL,
  old_amount numeric,
  new_amount numeric NOT NULL,
  old_stripe_price_id text,
  new_stripe_price_id text NOT NULL,
  stripe_product_id text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

GRANT SELECT ON public.plan_price_history TO authenticated;
GRANT ALL ON public.plan_price_history TO service_role;

ALTER TABLE public.plan_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view plan price history"
  ON public.plan_price_history FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Inserts are performed exclusively by the admin-update-plan-price edge
-- function using the service_role key, so no INSERT policy is needed for
-- regular users.

CREATE INDEX IF NOT EXISTS idx_plan_price_history_country_plan
  ON public.plan_price_history (country_code, plan, cycle, changed_at DESC);
