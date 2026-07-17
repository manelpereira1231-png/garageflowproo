
ALTER TABLE public.ai_usage_ledger ALTER COLUMN shop_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_platform_ai_credit(
  _function_name text, _cost integer DEFAULT 1, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_budget numeric;
  v_margin numeric;
  v_cost_per_credit numeric;
  v_month_spend numeric;
  v_cost_estimate numeric;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized'); END IF;
  IF NOT (public.has_role(v_user, 'super_admin'::app_role) OR public.has_role(v_user, 'admin'::app_role)) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  -- rate limit per admin user
  IF NOT public._ai_check_rate_limit('user', v_user, public._ai_setting_numeric('ai_rate_per_min_user', 10)::int) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'scope', 'user');
  END IF;

  v_budget := public._ai_setting_numeric('ai_monthly_budget_eur', 250);
  v_margin := public._ai_setting_numeric('ai_safety_margin_pct', 95);
  v_cost_per_credit := public._ai_setting_numeric('ai_cost_per_credit_eur', 0.02);
  v_cost_estimate := _cost * v_cost_per_credit;

  SELECT COALESCE(SUM(cost_estimate_eur),0) INTO v_month_spend
  FROM public.ai_usage_ledger WHERE created_at >= date_trunc('month', now()) AND cached = false;

  IF v_month_spend + v_cost_estimate > v_budget * (v_margin / 100.0) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'global_budget_exceeded',
      'month_spend', v_month_spend, 'budget', v_budget, 'margin_pct', v_margin);
  END IF;

  INSERT INTO public.ai_usage_ledger(shop_id, user_id, function_name, credits, plan_slug, metadata, cost_estimate_eur, cached)
  VALUES (NULL, v_user, _function_name, _cost, 'platform', _metadata, v_cost_estimate, false);

  RETURN jsonb_build_object('allowed', true, 'cost_estimate_eur', v_cost_estimate);
END;$$;

REVOKE ALL ON FUNCTION public.consume_platform_ai_credit(text, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_platform_ai_credit(text, integer, jsonb) TO authenticated, service_role;
