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
  IF _shop_id IS NULL OR _cap IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin(auth.uid()) THEN RETURN true; END IF;

  SELECT role INTO v_role
  FROM public.shop_users
  WHERE shop_id = _shop_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'owner' THEN RETURN true; END IF;
  IF v_role = 'admin' THEN
    RETURN _cap NOT IN ('settings.transfer_ownership','team.remove_owner');
  END IF;

  IF v_role = 'manager' THEN
    RETURN _cap IN (
      'dashboard.view',
      'clients.view','clients.create','clients.edit','clients.delete','clients.export',
      'vehicles.view','vehicles.create','vehicles.edit','vehicles.delete','vehicles.export',
      'quotes.view','quotes.create','quotes.edit','quotes.approve','quotes.delete','quotes.send_email','quotes.send_whatsapp','quotes.print','quotes.export',
      'work_orders.view','work_orders.create','work_orders.edit','work_orders.complete','work_orders.delete','work_orders.export','work_orders.print','work_orders.send_email','work_orders.send_whatsapp',
      'invoices.view','invoices.create','invoices.cancel','invoices.send_email','invoices.send_whatsapp','invoices.print','invoices.export',
      'stock.view','stock.manage','purchases.view','purchases.manage','agenda.view','agenda.manage','alerts.view','chat.view','team.view','audit.view'
    );
  END IF;

  IF v_role = 'reception' THEN
    RETURN _cap IN (
      'dashboard.view','clients.view','clients.create','clients.edit','vehicles.view','vehicles.create','vehicles.edit',
      'quotes.view','quotes.create','quotes.edit','quotes.send_email','quotes.send_whatsapp','quotes.print',
      'work_orders.view','work_orders.create','work_orders.edit','work_orders.print','work_orders.send_email','work_orders.send_whatsapp',
      'agenda.view','agenda.manage','invoices.view','invoices.print','invoices.send_email','invoices.send_whatsapp','alerts.view','chat.view'
    );
  END IF;

  IF v_role = 'commercial' THEN
    RETURN _cap IN (
      'dashboard.view','clients.view','clients.create','clients.edit','clients.export','vehicles.view','vehicles.create',
      'quotes.view','quotes.create','quotes.edit','quotes.send_email','quotes.send_whatsapp','quotes.print',
      'agenda.view','chat.view','marketplace.view','marketplace.sales'
    );
  END IF;

  IF v_role = 'technician' THEN
    RETURN _cap IN ('dashboard.view','work_orders.view','work_orders.edit','work_orders.complete','work_orders.print','vehicles.view','agenda.view');
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "clients_role_insert" ON public.clients;
CREATE POLICY "clients_role_insert" ON public.clients AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_capability(shop_id, 'clients.create'));
DROP POLICY IF EXISTS "clients_role_update" ON public.clients;
CREATE POLICY "clients_role_update" ON public.clients AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_capability(shop_id, 'clients.edit')) WITH CHECK (public.has_capability(shop_id, 'clients.edit'));
DROP POLICY IF EXISTS "clients_role_delete" ON public.clients;
CREATE POLICY "clients_role_delete" ON public.clients AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_capability(shop_id, 'clients.delete'));

DROP POLICY IF EXISTS "vehicles_role_insert" ON public.vehicles;
CREATE POLICY "vehicles_role_insert" ON public.vehicles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_capability(shop_id, 'vehicles.create'));
DROP POLICY IF EXISTS "vehicles_role_update" ON public.vehicles;
CREATE POLICY "vehicles_role_update" ON public.vehicles AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_capability(shop_id, 'vehicles.edit')) WITH CHECK (public.has_capability(shop_id, 'vehicles.edit'));
DROP POLICY IF EXISTS "vehicles_role_delete" ON public.vehicles;
CREATE POLICY "vehicles_role_delete" ON public.vehicles AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_capability(shop_id, 'vehicles.delete'));

DROP POLICY IF EXISTS "quotes_role_insert" ON public.quotes;
CREATE POLICY "quotes_role_insert" ON public.quotes AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_capability(shop_id, 'quotes.create'));
DROP POLICY IF EXISTS "quotes_role_update" ON public.quotes;
CREATE POLICY "quotes_role_update" ON public.quotes AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_capability(shop_id, 'quotes.edit') OR public.has_capability(shop_id, 'quotes.approve')) WITH CHECK (public.has_capability(shop_id, 'quotes.edit') OR public.has_capability(shop_id, 'quotes.approve'));
DROP POLICY IF EXISTS "quotes_role_delete" ON public.quotes;
CREATE POLICY "quotes_role_delete" ON public.quotes AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_capability(shop_id, 'quotes.delete'));

DROP POLICY IF EXISTS "work_orders_role_insert" ON public.work_orders;
CREATE POLICY "work_orders_role_insert" ON public.work_orders AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_capability(shop_id, 'work_orders.create'));
DROP POLICY IF EXISTS "work_orders_role_update" ON public.work_orders;
CREATE POLICY "work_orders_role_update" ON public.work_orders AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_capability(shop_id, 'work_orders.edit') OR public.has_capability(shop_id, 'work_orders.complete')) WITH CHECK (public.has_capability(shop_id, 'work_orders.edit') OR public.has_capability(shop_id, 'work_orders.complete'));
DROP POLICY IF EXISTS "work_orders_role_delete" ON public.work_orders;
CREATE POLICY "work_orders_role_delete" ON public.work_orders AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_capability(shop_id, 'work_orders.delete'));

DROP POLICY IF EXISTS "invoices_role_insert" ON public.invoices;
CREATE POLICY "invoices_role_insert" ON public.invoices AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_capability(shop_id, 'invoices.create'));
DROP POLICY IF EXISTS "invoices_role_update" ON public.invoices;
CREATE POLICY "invoices_role_update" ON public.invoices AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_capability(shop_id, 'invoices.create') OR public.has_capability(shop_id, 'invoices.cancel')) WITH CHECK (public.has_capability(shop_id, 'invoices.create') OR public.has_capability(shop_id, 'invoices.cancel'));
DROP POLICY IF EXISTS "invoices_role_delete" ON public.invoices;
CREATE POLICY "invoices_role_delete" ON public.invoices AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_capability(shop_id, 'invoices.cancel'));

DROP POLICY IF EXISTS "payments_role_select" ON public.payments;
CREATE POLICY "payments_role_select" ON public.payments AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_capability(shop_id, 'finance.view_costs') OR public.has_capability(shop_id, 'invoices.view'));
DROP POLICY IF EXISTS "payments_role_insert" ON public.payments;
CREATE POLICY "payments_role_insert" ON public.payments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_capability(shop_id, 'invoices.create'));
DROP POLICY IF EXISTS "payments_role_update" ON public.payments;
CREATE POLICY "payments_role_update" ON public.payments AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_capability(shop_id, 'invoices.create')) WITH CHECK (public.has_capability(shop_id, 'invoices.create'));
DROP POLICY IF EXISTS "payments_role_delete" ON public.payments;
CREATE POLICY "payments_role_delete" ON public.payments AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_capability(shop_id, 'invoices.cancel'));

DROP POLICY IF EXISTS "market_sales_offers_role_select" ON public.carity_offers;
CREATE POLICY "market_sales_offers_role_select" ON public.carity_offers
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.carity_listings l
      WHERE l.id = listing_id
        AND (public.has_capability(l.shop_id, 'marketplace.sales') OR public.has_capability(l.shop_id, 'marketplace.manage'))
    )
    OR public.is_super_admin(auth.uid())
  );