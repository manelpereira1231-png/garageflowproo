
-- Create validate_plan_limit function for backend enforcement
CREATE OR REPLACE FUNCTION public.validate_plan_limit(_action_type text, _shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan text;
  _status text;
  _effective_plan text;
  _quote_count int;
  _month_start timestamptz;
BEGIN
  -- Get current plan and status
  SELECT s.plan, s.status INTO _plan, _status
  FROM public.subscriptions s
  WHERE s.shop_id = _shop_id
  LIMIT 1;

  -- Default to free if no subscription
  IF _plan IS NULL THEN
    _effective_plan := 'free';
  ELSIF _status NOT IN ('active', 'trialing') THEN
    _effective_plan := 'free';
  ELSE
    _effective_plan := _plan;
  END IF;

  -- Validate based on action type
  CASE _action_type
    WHEN 'create_quote' THEN
      IF _effective_plan = 'free' THEN
        _month_start := date_trunc('month', now());
        SELECT count(*) INTO _quote_count
        FROM public.quotes
        WHERE shop_id = _shop_id AND created_at >= _month_start;
        RETURN _quote_count < 10;
      END IF;
      RETURN true;

    WHEN 'create_advanced_alert' THEN
      RETURN _effective_plan IN ('pro', 'garage');

    WHEN 'create_basic_alert' THEN
      RETURN _effective_plan IN ('pro', 'garage');

    WHEN 'use_multi_shop' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_automations' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_chatbot' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_api' THEN
      RETURN _effective_plan = 'garage';

    ELSE
      RETURN true;
  END CASE;
END;
$$;

-- Add index on alerts(shop_id) for performance
CREATE INDEX IF NOT EXISTS idx_alerts_shop_id ON public.alerts(shop_id);

-- Add index on quotes(shop_id, created_at) for quota checks
CREATE INDEX IF NOT EXISTS idx_quotes_shop_id_created ON public.quotes(shop_id, created_at);
