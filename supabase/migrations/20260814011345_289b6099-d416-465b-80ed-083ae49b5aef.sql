CREATE OR REPLACE FUNCTION public.consume_ai_credit(_shop_id uuid, _function_name text, _cost integer DEFAULT 1, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_member boolean;
  v_plan_slug text;
  v_limit int;
  v_used int;
  v_budget numeric;
  v_margin numeric;
  v_cost_per_credit numeric;
  v_month_spend numeric;
  v_rate_user int;
  v_rate_shop int;
  v_cost_estimate numeric;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.shop_users WHERE shop_id = _shop_id AND user_id = v_user) INTO v_is_member;
  IF NOT v_is_member THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_a_member'); END IF;

  -- CONCORRÊNCIA: serializa o par verificar-quota/inserir-consumo por oficina.
  -- Sem isto, chamadas simultâneas liam o mesmo "used" e ultrapassavam o limite.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_credit:' || _shop_id::text, 0));

  SELECT p.slug, COALESCE((p.limits->>'max_ai_credits_month')::int, 0)
  INTO v_plan_slug, v_limit
  FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
  WHERE s.shop_id = _shop_id ORDER BY s.created_at DESC LIMIT 1;

  IF v_plan_slug IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription'); END IF;
  IF v_limit = 0 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'plan_no_ai', 'plan', v_plan_slug); END IF;

  v_rate_user := public._ai_setting_numeric('ai_rate_per_min_user', 10)::int;
  v_rate_shop := public._ai_setting_numeric('ai_rate_per_min_shop', 30)::int;
  IF NOT public._ai_check_rate_limit('user', v_user, v_rate_user) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'scope', 'user');
  END IF;
  IF NOT public._ai_check_rate_limit('shop', _shop_id, v_rate_shop) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'scope', 'shop');
  END IF;

  v_budget := public._ai_setting_numeric('ai_monthly_budget_eur', 250);
  v_margin := public._ai_setting_numeric('ai_safety_margin_pct', 95);
  v_cost_per_credit := public._ai_setting_numeric('ai_cost_per_credit_eur', 0.02);
  v_cost_estimate := _cost * v_cost_per_credit;

  SELECT COALESCE(SUM(cost_estimate_eur),0) INTO v_month_spend
  FROM public.ai_usage_ledger
  WHERE created_at >= date_trunc('month', now()) AND cached = false;

  IF v_month_spend + v_cost_estimate > v_budget * (v_margin / 100.0) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'global_budget_exceeded',
      'month_spend', v_month_spend, 'budget', v_budget, 'margin_pct', v_margin);
  END IF;

  SELECT COALESCE(SUM(credits),0) INTO v_used FROM public.ai_usage_ledger
  WHERE shop_id = _shop_id AND created_at >= date_trunc('month', now()) AND cached = false;

  IF v_limit > 0 AND (v_used + _cost) > v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'used', v_used, 'limit', v_limit);
  END IF;

  INSERT INTO public.ai_usage_ledger(shop_id, user_id, function_name, credits, plan_slug, metadata, cost_estimate_eur, prompt_hash, cached)
  VALUES (_shop_id, v_user, _function_name, _cost, v_plan_slug, _metadata, v_cost_estimate, _metadata->>'prompt_hash', false);

  RETURN jsonb_build_object('allowed', true, 'plan', v_plan_slug, 'limit', v_limit,
    'used', v_used + _cost, 'remaining', GREATEST(v_limit - (v_used + _cost), 0),
    'cost_estimate_eur', v_cost_estimate);
END;$function$;

CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_shop_month ON public.ai_usage_ledger (shop_id, created_at) WHERE cached = false;