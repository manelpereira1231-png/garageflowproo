-- 1) Permitir que administradores autenticados executem a função de estatísticas de IA
GRANT EXECUTE ON FUNCTION public.get_ai_admin_stats() TO authenticated;

-- 2) Remover restrição duplicada na chave das definições da plataforma
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_key_unique;

-- 3) Incluir o número de respostas em cache no resultado das estatísticas
CREATE OR REPLACE FUNCTION public.get_ai_admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb; v_budget numeric; v_margin numeric; v_month_spend numeric; v_month_calls int; v_today_calls int; v_cache int;
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
  SELECT COUNT(*) INTO v_cache FROM public.ai_response_cache;

  v_result := jsonb_build_object(
    'budget_eur', v_budget, 'safety_margin_pct', v_margin,
    'month_spend_eur', v_month_spend,
    'month_pct', CASE WHEN v_budget > 0 THEN round((v_month_spend / v_budget * 100)::numeric, 2) ELSE 0 END,
    'month_calls', v_month_calls, 'today_calls', v_today_calls,
    'cache_entries', v_cache,
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
END;$function$;

GRANT EXECUTE ON FUNCTION public.get_ai_admin_stats() TO authenticated;