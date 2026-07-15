-- RBAC hardening for document-number RPCs and final capability drift.

CREATE OR REPLACE FUNCTION public.has_capability(_shop_id uuid, _cap text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF _shop_id IS NULL OR _cap IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role
    FROM public.shop_users
   WHERE shop_id = _shop_id
     AND user_id = auth.uid()
   LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  IF v_role = 'admin' THEN
    IF _cap IN ('settings.transfer_ownership','team.remove_owner') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_role = 'manager' THEN
    RETURN _cap IN (
      'dashboard.view',
      'clients.view','clients.create','clients.edit','clients.delete','clients.export',
      'vehicles.view','vehicles.create','vehicles.edit','vehicles.delete','vehicles.export',
      'quotes.view','quotes.create','quotes.edit','quotes.approve','quotes.delete',
      'quotes.send_email','quotes.send_whatsapp','quotes.print','quotes.export',
      'work_orders.view','work_orders.create','work_orders.edit','work_orders.complete',
      'work_orders.delete','work_orders.export','work_orders.print','work_orders.send_email','work_orders.send_whatsapp',
      'invoices.view','invoices.create','invoices.cancel',
      'invoices.send_email','invoices.send_whatsapp','invoices.print','invoices.export',
      'finance.view_costs','finance.view_profits',
      'stock.view','stock.manage','purchases.view','purchases.manage',
      'agenda.view','agenda.manage',
      'alerts.view','chat.view','automations.view','loyalty.view','marketplace.view',
      'team.view','audit.view'
    );
  END IF;

  IF v_role = 'reception' THEN
    RETURN _cap IN (
      'dashboard.view',
      'clients.view','clients.create','clients.edit',
      'vehicles.view','vehicles.create','vehicles.edit',
      'quotes.view','quotes.create','quotes.edit',
      'quotes.send_email','quotes.send_whatsapp','quotes.print',
      'work_orders.view','work_orders.create','work_orders.edit','work_orders.print','work_orders.send_email','work_orders.send_whatsapp',
      'agenda.view','agenda.manage',
      'invoices.view','invoices.print','invoices.send_email','invoices.send_whatsapp',
      'alerts.view','chat.view'
    );
  END IF;

  IF v_role = 'commercial' THEN
    RETURN _cap IN (
      'dashboard.view',
      'clients.view','clients.create','clients.edit','clients.export',
      'vehicles.view','vehicles.create',
      'quotes.view','quotes.create','quotes.edit',
      'quotes.send_email','quotes.send_whatsapp','quotes.print',
      'agenda.view','chat.view','loyalty.view','marketplace.view'
    );
  END IF;

  IF v_role = 'technician' THEN
    RETURN _cap IN (
      'dashboard.view',
      'work_orders.view','work_orders.edit','work_orders.complete','work_orders.print',
      'vehicles.view',
      'agenda.view'
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.next_number(_shop_id uuid, _prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _max_num int;
  _table text;
  _required_cap text;
BEGIN
  IF _prefix = 'ORC' THEN
    _table := 'quotes';
    _required_cap := 'quotes.create';
  ELSIF _prefix = 'SRV' THEN
    _table := 'work_orders';
    _required_cap := 'work_orders.create';
  ELSE
    RAISE EXCEPTION 'Unknown prefix: %', _prefix;
  END IF;

  IF NOT public.has_capability(_shop_id, _required_cap) THEN
    RAISE EXCEPTION 'permission denied for %', _required_cap USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.next_invoice_number(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year text;
  _max_num int;
BEGIN
  IF NOT public.has_capability(_shop_id, 'invoices.create') THEN
    RAISE EXCEPTION 'permission denied for invoices.create' USING ERRCODE = '42501';
  END IF;

  _year := extract(year from now())::text;
  
  SELECT COALESCE(MAX(
    CASE WHEN number ~ ('^FAT-' || _year || '-\d+$')
      THEN NULLIF(regexp_replace(number, '^.*-', ''), '')::int
      ELSE 0
    END
  ), 0) INTO _max_num
  FROM public.invoices
  WHERE shop_id = _shop_id;
  
  RETURN 'FAT-' || _year || '-' || lpad((_max_num + 1)::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;