
ALTER TABLE public.ai_usage_ledger
  ADD COLUMN IF NOT EXISTS cost_estimate_eur numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_hash text,
  ADD COLUMN IF NOT EXISTS cached boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ai_usage_ledger_function_idx ON public.ai_usage_ledger (function_name);
CREATE INDEX IF NOT EXISTS ai_usage_ledger_created_idx ON public.ai_usage_ledger (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  cache_key text PRIMARY KEY,
  shop_id uuid,
  function_name text NOT NULL,
  response jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_response_cache TO service_role;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ai_response_cache_expires_idx ON public.ai_response_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  subject_type text NOT NULL CHECK (subject_type IN ('user','shop')),
  subject_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_type, subject_id, window_start)
);
GRANT ALL ON public.ai_rate_limits TO service_role;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ai_rate_limits_window_idx ON public.ai_rate_limits (window_start);

INSERT INTO public.platform_settings (key, value) VALUES
  ('ai_monthly_budget_eur', '250'::jsonb),
  ('ai_safety_margin_pct', '95'::jsonb),
  ('ai_rate_per_min_user', '10'::jsonb),
  ('ai_rate_per_min_shop', '30'::jsonb),
  ('ai_cache_ttl_seconds', '900'::jsonb),
  ('ai_cost_per_credit_eur', '0.02'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._ai_setting_numeric(_key text, _default numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(value::text, 'null')::numeric, _default)
  FROM public.platform_settings WHERE key = _key LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._ai_check_rate_limit(_subject_type text, _subject_id uuid, _limit int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_window timestamptz := date_trunc('minute', now()); v_count int;
BEGIN
  IF _subject_id IS NULL OR _limit <= 0 THEN RETURN true; END IF;
  INSERT INTO public.ai_rate_limits (subject_type, subject_id, window_start, count)
  VALUES (_subject_type, _subject_id, v_window, 1)
  ON CONFLICT (subject_type, subject_id, window_start)
  DO UPDATE SET count = ai_rate_limits.count + 1
  RETURNING count INTO v_count;
  IF random() < 0.02 THEN
    DELETE FROM public.ai_rate_limits WHERE window_start < now() - interval '5 minutes';
  END IF;
  RETURN v_count <= _limit;
END;$$;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(
  _shop_id uuid, _function_name text, _cost integer DEFAULT 1, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END;$$;

REVOKE ALL ON FUNCTION public.consume_ai_credit(uuid, text, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, text, integer, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_try_cache(_cache_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_resp jsonb;
BEGIN
  IF random() < 0.05 THEN DELETE FROM public.ai_response_cache WHERE expires_at < now(); END IF;
  SELECT response INTO v_resp FROM public.ai_response_cache
  WHERE cache_key = _cache_key AND expires_at > now() LIMIT 1;
  RETURN v_resp;
END;$$;

CREATE OR REPLACE FUNCTION public.ai_save_cache(_cache_key text, _shop_id uuid, _function_name text, _response jsonb, _ttl_seconds int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ttl int;
BEGIN
  v_ttl := COALESCE(_ttl_seconds, public._ai_setting_numeric('ai_cache_ttl_seconds', 900)::int);
  INSERT INTO public.ai_response_cache(cache_key, shop_id, function_name, response, expires_at)
  VALUES (_cache_key, _shop_id, _function_name, _response, now() + (v_ttl || ' seconds')::interval)
  ON CONFLICT (cache_key) DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at;
END;$$;

REVOKE ALL ON FUNCTION public.ai_try_cache(text) FROM public;
REVOKE ALL ON FUNCTION public.ai_save_cache(text, uuid, text, jsonb, int) FROM public;
GRANT EXECUTE ON FUNCTION public.ai_try_cache(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_save_cache(text, uuid, text, jsonb, int) TO service_role;

CREATE OR REPLACE FUNCTION public.ai_log_cache_hit(_shop_id uuid, _function_name text, _prompt_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_plan text;
BEGIN
  SELECT p.slug INTO v_plan FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
  WHERE s.shop_id = _shop_id ORDER BY s.created_at DESC LIMIT 1;
  INSERT INTO public.ai_usage_ledger(shop_id, user_id, function_name, credits, plan_slug, cost_estimate_eur, prompt_hash, cached, metadata)
  VALUES (_shop_id, v_user, _function_name, 0, v_plan, 0, _prompt_hash, true, '{}'::jsonb);
END;$$;

REVOKE ALL ON FUNCTION public.ai_log_cache_hit(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ai_log_cache_hit(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_ai_admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb; v_budget numeric; v_margin numeric; v_month_spend numeric; v_month_calls int; v_today_calls int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  v_budget := public._ai_setting_numeric('ai_monthly_budget_eur', 250);
  v_margin := public._ai_setting_numeric('ai_safety_margin_pct', 95);
  SELECT COALESCE(SUM(cost_estimate_eur),0), COUNT(*) INTO v_month_spend, v_month_calls
  FROM public.ai_usage_ledger WHERE created_at >= date_trunc('month', now());
  SELECT COUNT(*) INTO v_today_calls FROM public.ai_usage_ledger WHERE created_at >= date_trunc('day', now());

  v_result := jsonb_build_object(
    'budget_eur', v_budget, 'safety_margin_pct', v_margin,
    'month_spend_eur', v_month_spend,
    'month_pct', CASE WHEN v_budget > 0 THEN round((v_month_spend / v_budget * 100)::numeric, 2) ELSE 0 END,
    'month_calls', v_month_calls, 'today_calls', v_today_calls,
    'blocked_globally', v_month_spend >= v_budget * (v_margin / 100.0),
    'top_shops', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT l.shop_id, s.name AS shop_name, COUNT(*) AS calls, SUM(l.cost_estimate_eur) AS cost
      FROM public.ai_usage_ledger l LEFT JOIN public.shops s ON s.id = l.shop_id
      WHERE l.created_at >= date_trunc('month', now())
      GROUP BY l.shop_id, s.name ORDER BY calls DESC LIMIT 10) x), '[]'::jsonb),
    'top_functions', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT function_name, COUNT(*) AS calls, SUM(cost_estimate_eur) AS cost
      FROM public.ai_usage_ledger WHERE created_at >= date_trunc('month', now())
      GROUP BY function_name ORDER BY calls DESC LIMIT 10) x), '[]'::jsonb),
    'by_plan', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT plan_slug, COUNT(*) AS calls, SUM(cost_estimate_eur) AS cost
      FROM public.ai_usage_ledger WHERE created_at >= date_trunc('month', now())
      GROUP BY plan_slug ORDER BY calls DESC) x), '[]'::jsonb),
    'by_day', COALESCE((SELECT jsonb_agg(x ORDER BY day) FROM (
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*) AS calls, SUM(cost_estimate_eur) AS cost
      FROM public.ai_usage_ledger WHERE created_at >= now() - interval '30 days'
      GROUP BY 1) x), '[]'::jsonb)
  );
  RETURN v_result;
END;$$;

REVOKE ALL ON FUNCTION public.get_ai_admin_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.get_ai_admin_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_ai_global_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_budget numeric; v_margin numeric; v_spend numeric;
BEGIN
  v_budget := public._ai_setting_numeric('ai_monthly_budget_eur', 250);
  v_margin := public._ai_setting_numeric('ai_safety_margin_pct', 95);
  SELECT COALESCE(SUM(cost_estimate_eur),0) INTO v_spend
  FROM public.ai_usage_ledger WHERE created_at >= date_trunc('month', now()) AND cached = false;
  RETURN jsonb_build_object(
    'month_spend_eur', v_spend, 'budget_eur', v_budget, 'safety_margin_pct', v_margin,
    'pct', CASE WHEN v_budget > 0 THEN round((v_spend / v_budget * 100)::numeric, 2) ELSE 0 END,
    'blocked', v_spend >= v_budget * (v_margin / 100.0)
  );
END;$$;

REVOKE ALL ON FUNCTION public.get_ai_global_status() FROM public;
GRANT EXECUTE ON FUNCTION public.get_ai_global_status() TO authenticated, service_role;
