CREATE OR REPLACE FUNCTION public.cascade_delete_shop(_shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM email_logs WHERE shop_id = _shop_id;
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