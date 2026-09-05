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
  -- REGRA DE VERACIDADE: só entra em MRR o que tem evidência de pagamento Stripe.
  -- Exclui contas demo, atribuições manuais do admin, ofertas e planos de entrada.
  WITH paid AS (
    SELECT
      s.plan,
      COALESCE(
        (SELECT pcp.amount
           FROM public.plan_country_prices pcp
          WHERE pcp.plan_slug = lower(s.plan)
            AND pcp.cycle = 'monthly'
            AND pcp.active = true
            AND pcp.country_code = COALESCE(sh.country, 'PT')
          LIMIT 1),
        (SELECT pcp.amount
           FROM public.plan_country_prices pcp
          WHERE pcp.plan_slug = lower(s.plan)
            AND pcp.cycle = 'monthly'
            AND pcp.active = true
            AND pcp.country_code = 'PT'
          LIMIT 1),
        0
      ) * (1 - COALESCE(s.discount_percent, 0) / 100.0) AS monthly_eur
    FROM public.subscriptions s
    JOIN public.shops sh ON sh.id = s.shop_id
    WHERE s.status = 'active'
      AND COALESCE(sh.is_demo, false) = false
      AND lower(COALESCE(s.plan, '')) NOT IN ('free', 'start')
      AND COALESCE(s.revenue_type, '') NOT IN ('manual_admin', 'gift', 'offer', 'free')
      AND (s.revenue_type = 'stripe_paid' OR s.stripe_subscription_id IS NOT NULL)
      AND COALESCE(s.discount_percent, 0) < 100
  )
  SELECT COALESCE(SUM(monthly_eur), 0), COUNT(*)
  INTO v_mrr, v_paying
  FROM paid;

  SELECT COUNT(*) INTO v_trial
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  WHERE s.status = 'trialing' AND COALESCE(sh.is_demo, false) = false;

  SELECT COUNT(*) INTO v_new
  FROM public.shops
  WHERE created_at::date = CURRENT_DATE AND COALESCE(is_demo, false) = false;

  SELECT COUNT(*) INTO v_churn
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  WHERE s.status IN ('canceled', 'cancelled', 'past_due')
    AND s.updated_at::date = CURRENT_DATE
    AND COALESCE(sh.is_demo, false) = false
    AND s.stripe_subscription_id IS NOT NULL;

  SELECT COUNT(*) INTO v_active_prev
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  WHERE s.status = 'active'
    AND s.created_at < CURRENT_DATE - 30
    AND COALESCE(sh.is_demo, false) = false
    AND (s.revenue_type = 'stripe_paid' OR s.stripe_subscription_id IS NOT NULL);

  IF v_active_prev > 0 THEN v_churn_rate := v_churn::numeric / v_active_prev; END IF;

  IF v_paying > 0 THEN
    v_arpu := v_mrr / v_paying;
    -- Sem churn real medido não existe LTV calculável: fica 0 (NÃO DISPONÍVEL).
    v_ltv := CASE WHEN v_churn_rate > 0 THEN v_arpu / v_churn_rate ELSE 0 END;
  END IF;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(platform_fee), 0)
  INTO v_gmv, v_comm
  FROM public.market_escrow
  WHERE status IN ('released', 'delivery_confirmed') AND released_at::date = CURRENT_DATE;

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