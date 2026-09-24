CREATE TABLE public.shop_commercial_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  plan_slug text NOT NULL REFERENCES public.plans(slug),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  condition_type text NOT NULL CHECK (condition_type IN ('normal','fixed_temporary','fixed_permanent','percent_temporary','percent_permanent','free_months','dated')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','scheduled','expired','cancelled','sync_error','review_required')),
  application_timing text NOT NULL DEFAULT 'next_renewal' CHECK (application_timing IN ('immediate','next_renewal','specific_date')),
  value_minor bigint,
  percent_off numeric(5,2),
  currency text NOT NULL,
  duration_months integer,
  starts_at timestamptz,
  ends_at timestamptz,
  returns_to_standard boolean NOT NULL DEFAULT true,
  reason text NOT NULL,
  internal_note text,
  base_amount_minor bigint NOT NULL,
  effective_amount_minor bigint NOT NULL,
  after_amount_minor bigint NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_schedule_id text,
  stripe_coupon_id text,
  stripe_price_id text,
  stripe_discount_id text,
  stripe_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_error text,
  request_key text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (value_minor IS NULL OR value_minor >= 0),
  CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  CHECK (duration_months IS NULL OR duration_months > 0),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

GRANT SELECT, INSERT, UPDATE ON public.shop_commercial_conditions TO authenticated;
GRANT ALL ON public.shop_commercial_conditions TO service_role;

ALTER TABLE public.shop_commercial_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read commercial conditions"
ON public.shop_commercial_conditions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins create commercial conditions"
ON public.shop_commercial_conditions FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Super admins update commercial conditions"
ON public.shop_commercial_conditions FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX shop_commercial_conditions_shop_created_idx
ON public.shop_commercial_conditions(shop_id, created_at DESC);

CREATE UNIQUE INDEX shop_commercial_conditions_one_live_idx
ON public.shop_commercial_conditions(shop_id)
WHERE status IN ('pending','active','scheduled','sync_error','review_required');

ALTER TABLE public.subscriptions
  ADD COLUMN effective_amount_minor bigint,
  ADD COLUMN effective_currency text,
  ADD COLUMN commercial_condition_id uuid REFERENCES public.shop_commercial_conditions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.subscriptions.discount_percent IS 'DEPRECATED: legacy visual-only discount; replaced by shop_commercial_conditions';
COMMENT ON COLUMN public.subscriptions.discount_reason IS 'DEPRECATED: legacy visual-only discount; replaced by shop_commercial_conditions';
COMMENT ON TABLE public.shop_commercial_conditions IS 'Stripe-confirmed commercial terms per workshop; append-only history with lifecycle status updates.';

CREATE OR REPLACE FUNCTION public.set_shop_commercial_condition_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_shop_commercial_condition_updated_at_trg
BEFORE UPDATE ON public.shop_commercial_conditions
FOR EACH ROW EXECUTE FUNCTION public.set_shop_commercial_condition_updated_at();