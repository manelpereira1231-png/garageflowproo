-- RBAC hardening: enforce capability-aware reads and auxiliary ERP operations.
-- These RESTRICTIVE policies layer on top of existing shop membership policies.

-- Keep the canonical capability matrix explicit in the database.
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
      'work_orders.delete','work_orders.export','work_orders.print',
      'invoices.view','invoices.create','invoices.cancel',
      'invoices.send_email','invoices.print','invoices.export',
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
      'work_orders.view','work_orders.create',
      'agenda.view','agenda.manage',
      'invoices.view','invoices.print',
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
      'work_orders.view','work_orders.edit','work_orders.complete',
      'work_orders.print',
      'vehicles.view',
      'agenda.view'
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;

-- Core ERP read policies ---------------------------------------------------
DROP POLICY IF EXISTS "clients_role_select" ON public.clients;
CREATE POLICY "clients_role_select" ON public.clients
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'clients.view'));

DROP POLICY IF EXISTS "vehicles_role_select" ON public.vehicles;
CREATE POLICY "vehicles_role_select" ON public.vehicles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'vehicles.view'));

DROP POLICY IF EXISTS "quotes_role_select" ON public.quotes;
CREATE POLICY "quotes_role_select" ON public.quotes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'quotes.view'));

DROP POLICY IF EXISTS "work_orders_role_select" ON public.work_orders;
CREATE POLICY "work_orders_role_select" ON public.work_orders
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.view'));

DROP POLICY IF EXISTS "invoices_role_select" ON public.invoices;
CREATE POLICY "invoices_role_select" ON public.invoices
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'invoices.view'));

-- Auxiliary ERP modules ----------------------------------------------------
DROP POLICY IF EXISTS "appointments_role_select" ON public.appointments;
CREATE POLICY "appointments_role_select" ON public.appointments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'agenda.view'));

DROP POLICY IF EXISTS "appointments_role_update" ON public.appointments;
CREATE POLICY "appointments_role_update" ON public.appointments
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'agenda.manage'))
  WITH CHECK (public.has_capability(shop_id, 'agenda.manage'));

DROP POLICY IF EXISTS "appointments_role_delete" ON public.appointments;
CREATE POLICY "appointments_role_delete" ON public.appointments
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'agenda.manage'));

DROP POLICY IF EXISTS "appointments_role_insert_authenticated" ON public.appointments;
CREATE POLICY "appointments_role_insert_authenticated" ON public.appointments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'agenda.manage'));

DROP POLICY IF EXISTS "alerts_role_select" ON public.alerts;
CREATE POLICY "alerts_role_select" ON public.alerts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'alerts.view'));

DROP POLICY IF EXISTS "alerts_role_mutate" ON public.alerts;
CREATE POLICY "alerts_role_mutate" ON public.alerts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'alerts.view'))
  WITH CHECK (public.has_capability(shop_id, 'alerts.view'));

DROP POLICY IF EXISTS "chat_messages_role_select" ON public.chat_messages;
CREATE POLICY "chat_messages_role_select" ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'chat.view'));

DROP POLICY IF EXISTS "chat_messages_role_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_role_insert" ON public.chat_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'chat.view'));

DROP POLICY IF EXISTS "parts_role_select" ON public.parts;
CREATE POLICY "parts_role_select" ON public.parts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'stock.view'));

DROP POLICY IF EXISTS "parts_role_insert" ON public.parts;
CREATE POLICY "parts_role_insert" ON public.parts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'stock.manage'));

DROP POLICY IF EXISTS "parts_role_update" ON public.parts;
CREATE POLICY "parts_role_update" ON public.parts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'stock.manage'))
  WITH CHECK (public.has_capability(shop_id, 'stock.manage'));

DROP POLICY IF EXISTS "parts_role_delete" ON public.parts;
CREATE POLICY "parts_role_delete" ON public.parts
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'stock.manage'));

DROP POLICY IF EXISTS "stock_movements_role_select" ON public.stock_movements;
CREATE POLICY "stock_movements_role_select" ON public.stock_movements
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'stock.view'));

DROP POLICY IF EXISTS "stock_movements_role_mutate" ON public.stock_movements;
CREATE POLICY "stock_movements_role_mutate" ON public.stock_movements
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'stock.manage'))
  WITH CHECK (public.has_capability(shop_id, 'stock.manage'));

DROP POLICY IF EXISTS "service_catalog_role_select" ON public.service_catalog;
CREATE POLICY "service_catalog_role_select" ON public.service_catalog
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'stock.view'));

DROP POLICY IF EXISTS "service_catalog_role_mutate" ON public.service_catalog;
CREATE POLICY "service_catalog_role_mutate" ON public.service_catalog
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'stock.manage'))
  WITH CHECK (public.has_capability(shop_id, 'stock.manage'));

DROP POLICY IF EXISTS "loyalty_points_role_select" ON public.loyalty_points;
CREATE POLICY "loyalty_points_role_select" ON public.loyalty_points
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'loyalty.view'));

DROP POLICY IF EXISTS "loyalty_points_role_mutate" ON public.loyalty_points;
CREATE POLICY "loyalty_points_role_mutate" ON public.loyalty_points
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'loyalty.view'))
  WITH CHECK (public.has_capability(shop_id, 'loyalty.view'));

DROP POLICY IF EXISTS "loyalty_rewards_role_select" ON public.loyalty_rewards;
CREATE POLICY "loyalty_rewards_role_select" ON public.loyalty_rewards
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'loyalty.view'));

DROP POLICY IF EXISTS "loyalty_rewards_role_mutate" ON public.loyalty_rewards;
CREATE POLICY "loyalty_rewards_role_mutate" ON public.loyalty_rewards
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'loyalty.view'))
  WITH CHECK (public.has_capability(shop_id, 'loyalty.view'));

-- Work-order internals: visible only to work-order-capable roles.
DROP POLICY IF EXISTS "inspection_checklists_role_select" ON public.inspection_checklists;
CREATE POLICY "inspection_checklists_role_select" ON public.inspection_checklists
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.view'));

DROP POLICY IF EXISTS "inspection_checklists_role_mutate" ON public.inspection_checklists;
CREATE POLICY "inspection_checklists_role_mutate" ON public.inspection_checklists
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.edit'))
  WITH CHECK (public.has_capability(shop_id, 'work_orders.edit'));

DROP POLICY IF EXISTS "work_order_attachments_role_select" ON public.work_order_attachments;
CREATE POLICY "work_order_attachments_role_select" ON public.work_order_attachments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.view'));

DROP POLICY IF EXISTS "work_order_attachments_role_mutate" ON public.work_order_attachments;
CREATE POLICY "work_order_attachments_role_mutate" ON public.work_order_attachments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.edit'))
  WITH CHECK (public.has_capability(shop_id, 'work_orders.edit'));

DROP POLICY IF EXISTS "work_order_times_role_select" ON public.work_order_times;
CREATE POLICY "work_order_times_role_select" ON public.work_order_times
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.view'));

DROP POLICY IF EXISTS "work_order_times_role_mutate" ON public.work_order_times;
CREATE POLICY "work_order_times_role_mutate" ON public.work_order_times
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.edit'))
  WITH CHECK (public.has_capability(shop_id, 'work_orders.edit'));

-- Team management: only owner/admin can mutate team membership through API.
DROP POLICY IF EXISTS "shop_users_role_update" ON public.shop_users;
CREATE POLICY "shop_users_role_update" ON public.shop_users
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'team.manage') AND role <> 'owner')
  WITH CHECK (public.has_capability(shop_id, 'team.manage') AND role <> 'owner');

DROP POLICY IF EXISTS "shop_users_role_delete" ON public.shop_users;
CREATE POLICY "shop_users_role_delete" ON public.shop_users
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'team.manage') AND role <> 'owner');