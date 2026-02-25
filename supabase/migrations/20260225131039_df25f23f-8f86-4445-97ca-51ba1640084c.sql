
-- Server-side cascade delete for shops (replaces client-side logic)
CREATE OR REPLACE FUNCTION public.cascade_delete_shop(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM work_orders WHERE shop_id = _shop_id;
  DELETE FROM quotes WHERE shop_id = _shop_id;
  DELETE FROM alerts WHERE shop_id = _shop_id;
  DELETE FROM chat_messages WHERE shop_id = _shop_id;
  DELETE FROM notifications WHERE shop_id = _shop_id;
  DELETE FROM vehicles WHERE shop_id = _shop_id;
  DELETE FROM clients WHERE shop_id = _shop_id;
  DELETE FROM subscriptions WHERE shop_id = _shop_id;
  DELETE FROM shop_users WHERE shop_id = _shop_id;
  DELETE FROM shops WHERE id = _shop_id;
END;
$$;

-- Robust next number function (avoids duplicates)
CREATE OR REPLACE FUNCTION public.next_number(_shop_id uuid, _prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_num int;
  _table text;
BEGIN
  IF _prefix = 'ORC' THEN
    _table := 'quotes';
  ELSIF _prefix = 'SRV' THEN
    _table := 'work_orders';
  ELSE
    RAISE EXCEPTION 'Unknown prefix: %', _prefix;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(MAX(
      CASE WHEN number ~ (''^\s*'' || $1 || ''-\d+$'')
        THEN NULLIF(regexp_replace(number, ''^.*-'', ''''), '''')::int
        ELSE 0
      END
    ), 0) FROM %I WHERE shop_id = $2', _table
  ) INTO _max_num USING _prefix, _shop_id;

  RETURN _prefix || '-' || lpad((_max_num + 1)::text, 4, '0');
END;
$$;
