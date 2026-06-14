
-- Fix compute_business_metrics_snapshot: subscriptions has no `amount` column.
-- Derive MRR from plan tier using a static EUR mapping (matches public pricing).
CREATE OR REPLACE FUNCTION public.compute_business_metrics_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mrr numeric := 0; v_paying int := 0; v_trial int := 0;
  v_new int := 0; v_churn int := 0; v_churn_rate numeric := 0;
  v_ltv numeric := 0; v_arpu numeric := 0; v_gmv numeric := 0; v_comm numeric := 0;
  v_active_prev int := 0;
BEGIN
  -- Plan→price EUR/month mapping (mirrors public pricing tiers)
  WITH plan_price(plan, monthly_eur) AS (
    VALUES
      ('free', 0::numeric),
      ('starter', 19::numeric),
      ('pro', 39::numeric),
      ('garage', 99::numeric),
      ('enterprise', 299::numeric)
  ),
  active AS (
    SELECT s.plan, s.billing_cycle, COALESCE(pp.monthly_eur, 0) AS monthly_eur
    FROM public.subscriptions s
    LEFT JOIN plan_price pp ON pp.plan = lower(s.plan)
    WHERE s.status='active' AND s.stripe_subscription_id IS NOT NULL
  )
  SELECT
    COALESCE(SUM(CASE WHEN billing_cycle='yearly' THEN monthly_eur ELSE monthly_eur END),0),
    COUNT(*)
  INTO v_mrr, v_paying
  FROM active;

  SELECT COUNT(*) INTO v_trial FROM public.subscriptions WHERE status='trialing';
  SELECT COUNT(*) INTO v_new FROM public.shops WHERE created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_churn FROM public.subscriptions
    WHERE status IN ('canceled','past_due') AND updated_at::date = CURRENT_DATE;

  SELECT COUNT(*) INTO v_active_prev FROM public.subscriptions
    WHERE status='active' AND created_at < CURRENT_DATE - 30;
  IF v_active_prev > 0 THEN v_churn_rate := v_churn::numeric / v_active_prev; END IF;

  IF v_paying > 0 THEN
    v_arpu := v_mrr / v_paying;
    v_ltv := CASE WHEN v_churn_rate > 0 THEN v_arpu / v_churn_rate ELSE v_arpu * 36 END;
  END IF;

  SELECT COALESCE(SUM(amount),0), COALESCE(SUM(platform_fee),0)
  INTO v_gmv, v_comm
  FROM public.market_escrow
  WHERE status IN ('released','delivery_confirmed') AND released_at::date = CURRENT_DATE;

  INSERT INTO public.business_metrics_daily
    (snapshot_date, mrr_eur, arr_eur, paying_customers, trial_customers,
     new_signups, churned_customers, churn_rate, ltv_eur, arpu_eur,
     market_gmv_eur, market_commission_eur, computed_at)
  VALUES (CURRENT_DATE, v_mrr, v_mrr*12, v_paying, v_trial, v_new, v_churn,
     v_churn_rate, v_ltv, v_arpu, v_gmv, v_comm, now())
  ON CONFLICT (snapshot_date) DO UPDATE SET
    mrr_eur=EXCLUDED.mrr_eur, arr_eur=EXCLUDED.arr_eur,
    paying_customers=EXCLUDED.paying_customers, trial_customers=EXCLUDED.trial_customers,
    new_signups=EXCLUDED.new_signups, churned_customers=EXCLUDED.churned_customers,
    churn_rate=EXCLUDED.churn_rate, ltv_eur=EXCLUDED.ltv_eur, arpu_eur=EXCLUDED.arpu_eur,
    market_gmv_eur=EXCLUDED.market_gmv_eur, market_commission_eur=EXCLUDED.market_commission_eur,
    computed_at=now();

  RETURN jsonb_build_object('mrr',v_mrr,'paying',v_paying,'churn_rate',v_churn_rate,'ltv',v_ltv);
END $function$;

-- AI forecast persistence
CREATE TABLE IF NOT EXISTS public.business_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inputs jsonb NOT NULL,
  forecast jsonb NOT NULL,
  model text,
  notes text
);

GRANT SELECT, INSERT ON public.business_forecasts TO authenticated;
GRANT ALL ON public.business_forecasts TO service_role;

ALTER TABLE public.business_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read forecasts"
  ON public.business_forecasts FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins create forecasts"
  ON public.business_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND generated_by = auth.uid());
