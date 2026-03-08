
CREATE OR REPLACE FUNCTION public.validate_plan_limit(_action_type text, _shop_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _plan text;
  _status text;
  _effective_plan text;
  _quote_count int;
  _month_start timestamptz;
BEGIN
  SELECT s.plan, s.status INTO _plan, _status
  FROM public.subscriptions s
  WHERE s.shop_id = _shop_id
  LIMIT 1;

  IF _plan IS NULL THEN
    _effective_plan := 'free';
  ELSIF _status NOT IN ('active', 'trialing') THEN
    _effective_plan := 'free';
  ELSE
    _effective_plan := _plan;
  END IF;

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

    WHEN 'use_basic_automations' THEN
      RETURN _effective_plan IN ('pro', 'garage');

    WHEN 'use_chatbot' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_api' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_marketing' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_loyalty' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_quote_approval' THEN
      RETURN _effective_plan IN ('pro', 'garage');

    WHEN 'use_advanced_reports' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_basic_reports' THEN
      RETURN _effective_plan IN ('pro', 'garage');

    WHEN 'use_full_uploads' THEN
      RETURN _effective_plan = 'garage';

    WHEN 'use_csv_export' THEN
      RETURN _effective_plan IN ('pro', 'garage');

    ELSE
      RETURN true;
  END CASE;
END;
$function$;
