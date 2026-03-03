
CREATE OR REPLACE FUNCTION public.check_shop_creation_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _shop_count int;
  _best_plan text;
  _max_shops int;
BEGIN
  -- Count existing shops owned by this user
  SELECT count(*) INTO _shop_count FROM public.shops WHERE user_id = _user_id;

  -- Get the best plan across all user's shops
  SELECT COALESCE(
    (SELECT s.plan FROM public.subscriptions s
     INNER JOIN public.shops sh ON sh.id = s.shop_id
     WHERE sh.user_id = _user_id AND s.status IN ('active', 'trialing')
     ORDER BY CASE s.plan WHEN 'garage' THEN 3 WHEN 'pro' THEN 2 ELSE 1 END DESC
     LIMIT 1),
    'free'
  ) INTO _best_plan;

  -- Determine max shops allowed
  IF _best_plan = 'garage' THEN
    _max_shops := 5;
  ELSE
    _max_shops := 1;
  END IF;

  RETURN _shop_count < _max_shops;
END;
$$;
