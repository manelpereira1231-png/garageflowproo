CREATE OR REPLACE FUNCTION public.has_capability(_shop_id uuid, _cap text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  SELECT role INTO r FROM public.shop_users
  WHERE shop_id = _shop_id AND user_id = auth.uid()
  LIMIT 1;

  IF r IS NULL THEN RETURN false; END IF;

  -- Owner e super_admin: tudo
  IF r IN ('owner','super_admin') THEN RETURN true; END IF;

  -- Admin: tudo exceto transferência de propriedade e remoção do owner
  IF r = 'admin' THEN
    RETURN _cap <> 'settings.transfer_ownership' AND _cap <> 'team.remove_owner';
  END IF;

  -- Manager: gestão operacional, sem configurações críticas nem salários
  IF r = 'manager' THEN
    RETURN _cap = ANY (ARRAY[
      'dashboard.view',
      'clients.view','clients.create','clients.edit','clients.delete',
      'vehicles.view','vehicles.create','vehicles.edit','vehicles.delete',
      'quotes.view','quotes.create','quotes.edit','quotes.approve',
      'work_orders.view','work_orders.create','work_orders.edit','work_orders.complete',
      'invoices.view','invoices.create','invoices.cancel',
      'finance.view_costs','finance.view_profits',
      'stock.view','stock.manage','purchases.view','purchases.manage',
      'agenda.view','agenda.manage','alerts.view','chat.view','automations.view','loyalty.view','marketplace.view',
      'team.view','audit.view'
    ]);
  END IF;

  -- Receção: front-office e marcações
  IF r = 'reception' THEN
    RETURN _cap = ANY (ARRAY[
      'clients.view','clients.create','clients.edit',
      'vehicles.view','vehicles.create','vehicles.edit',
      'quotes.view','quotes.create','quotes.edit',
      'work_orders.view','work_orders.create',
      'agenda.view','agenda.manage',
      'invoices.view','alerts.view','chat.view'
    ]);
  END IF;

  -- Comercial: clientes, viaturas, orçamentos e seguimento comercial
  IF r = 'commercial' THEN
    RETURN _cap = ANY (ARRAY[
      'clients.view','clients.create','clients.edit',
      'vehicles.view','vehicles.create',
      'quotes.view','quotes.create','quotes.edit',
      'agenda.view','chat.view','loyalty.view'
    ]);
  END IF;

  -- Técnico: apenas execução operacional
  IF r = 'technician' THEN
    RETURN _cap = ANY (ARRAY[
      'work_orders.view','work_orders.edit','work_orders.complete',
      'agenda.view'
    ]);
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;