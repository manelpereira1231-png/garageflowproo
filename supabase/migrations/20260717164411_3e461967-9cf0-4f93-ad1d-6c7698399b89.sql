
-- 1. Ledger table for AI credit consumption
CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name text NOT NULL,
  credits integer NOT NULL DEFAULT 1,
  plan_slug text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_ledger_shop_month_idx
  ON public.ai_usage_ledger(shop_id, created_at DESC);

GRANT SELECT ON public.ai_usage_ledger TO authenticated;
GRANT ALL ON public.ai_usage_ledger TO service_role;

ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members can read their AI usage"
  ON public.ai_usage_ledger FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_users su
      WHERE su.shop_id = ai_usage_ledger.shop_id
        AND su.user_id = auth.uid()
    )
  );

-- 2. Get current AI usage + limit for a shop
CREATE OR REPLACE FUNCTION public.get_ai_usage(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_slug text;
  v_limit_raw text;
  v_limit integer;
  v_used integer;
  v_period_start timestamptz;
BEGIN
  -- Access control: caller must belong to shop OR be super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = _shop_id AND user_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT plan INTO v_plan_slug
  FROM public.subscriptions
  WHERE shop_id = _shop_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');

  SELECT (limits->>'max_ai_credits_month') INTO v_limit_raw
  FROM public.plans
  WHERE slug = v_plan_slug AND active = true;

  v_limit := CASE
    WHEN v_limit_raw IS NULL THEN 0
    WHEN v_limit_raw = '-1' THEN -1
    ELSE v_limit_raw::integer
  END;

  v_period_start := date_trunc('month', now());

  SELECT COALESCE(SUM(credits), 0) INTO v_used
  FROM public.ai_usage_ledger
  WHERE shop_id = _shop_id AND created_at >= v_period_start;

  RETURN jsonb_build_object(
    'plan', v_plan_slug,
    'used', v_used,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit = -1 THEN -1 ELSE GREATEST(v_limit - v_used, 0) END,
    'unlimited', v_limit = -1,
    'period_start', v_period_start
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_usage(uuid) TO authenticated;

-- 3. Atomic consume: checks & inserts in one transaction
CREATE OR REPLACE FUNCTION public.consume_ai_credit(
  _shop_id uuid,
  _function_name text,
  _cost integer DEFAULT 1,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_slug text;
  v_limit_raw text;
  v_limit integer;
  v_used integer;
  v_period_start timestamptz;
  v_user uuid;
BEGIN
  v_user := auth.uid();

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = _shop_id AND user_id = v_user
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_member');
  END IF;

  SELECT plan INTO v_plan_slug
  FROM public.subscriptions
  WHERE shop_id = _shop_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');

  SELECT (limits->>'max_ai_credits_month') INTO v_limit_raw
  FROM public.plans
  WHERE slug = v_plan_slug AND active = true;

  v_limit := CASE
    WHEN v_limit_raw IS NULL THEN 0
    WHEN v_limit_raw = '-1' THEN -1
    ELSE v_limit_raw::integer
  END;

  v_period_start := date_trunc('month', now());

  SELECT COALESCE(SUM(credits), 0) INTO v_used
  FROM public.ai_usage_ledger
  WHERE shop_id = _shop_id AND created_at >= v_period_start;

  IF v_limit = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'plan_no_ai',
      'plan', v_plan_slug,
      'used', v_used,
      'limit', 0
    );
  END IF;

  IF v_limit <> -1 AND (v_used + _cost) > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'plan', v_plan_slug,
      'used', v_used,
      'limit', v_limit
    );
  END IF;

  INSERT INTO public.ai_usage_ledger(shop_id, user_id, function_name, credits, plan_slug, metadata)
  VALUES (_shop_id, v_user, _function_name, _cost, v_plan_slug, COALESCE(_metadata, '{}'::jsonb));

  RETURN jsonb_build_object(
    'allowed', true,
    'plan', v_plan_slug,
    'used', v_used + _cost,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit = -1 THEN -1 ELSE v_limit - v_used - _cost END,
    'unlimited', v_limit = -1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, text, integer, jsonb) TO authenticated, service_role;

-- 4. Realtime for the ledger
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_usage_ledger;
ALTER TABLE public.ai_usage_ledger REPLICA IDENTITY FULL;

-- 5. Sensible defaults for existing plans (only if limit is null)
UPDATE public.plans SET limits = jsonb_set(COALESCE(limits,'{}'::jsonb), '{max_ai_credits_month}', '0'::jsonb)
  WHERE slug = 'free' AND (limits->>'max_ai_credits_month') IS NULL;
UPDATE public.plans SET limits = jsonb_set(COALESCE(limits,'{}'::jsonb), '{max_ai_credits_month}', '50'::jsonb)
  WHERE slug = 'pro' AND (limits->>'max_ai_credits_month') IS NULL;
UPDATE public.plans SET limits = jsonb_set(COALESCE(limits,'{}'::jsonb), '{max_ai_credits_month}', '500'::jsonb)
  WHERE slug = 'garage' AND (limits->>'max_ai_credits_month') IS NULL;
UPDATE public.plans SET limits = jsonb_set(COALESCE(limits,'{}'::jsonb), '{max_ai_credits_month}', '-1'::jsonb)
  WHERE slug = 'enterprise' AND (limits->>'max_ai_credits_month') IS NULL;
