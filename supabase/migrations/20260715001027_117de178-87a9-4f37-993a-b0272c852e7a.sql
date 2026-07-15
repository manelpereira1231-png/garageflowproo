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