CREATE OR REPLACE FUNCTION public.get_my_commercial_offer(_shop_id uuid)
RETURNS TABLE(plan_slug text, billing_cycle text, condition_type text, status text, value_minor bigint, percent_off numeric, currency text, duration_months integer, base_amount_minor bigint, effective_amount_minor bigint, after_amount_minor bigint, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.plan_slug, c.billing_cycle, c.condition_type, c.status, c.value_minor, c.percent_off, c.currency, c.duration_months, c.base_amount_minor, c.effective_amount_minor, c.after_amount_minor, c.ends_at
  FROM public.shop_commercial_conditions c
  WHERE c.shop_id = _shop_id
    AND c.status IN ('pending','active','scheduled')
    AND _shop_id IN (SELECT public.get_user_shop_ids(auth.uid()))
  ORDER BY c.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_my_commercial_offer(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_commercial_offer(uuid) TO authenticated;