-- ============================================================
-- FASE 1 — FUNDAÇÃO
-- ============================================================

-- 1.1  Restrição de valores válidos em shop_users.role
--     (Enum criaria dores de migração com FKs; CHECK é seguro e reversível.)
ALTER TABLE public.shop_users
  DROP CONSTRAINT IF EXISTS shop_users_role_check;
ALTER TABLE public.shop_users
  ADD CONSTRAINT shop_users_role_check
  CHECK (role IN ('owner','admin','manager','reception','commercial','technician'));

-- 1.2  has_capability() alargado: novas capacidades granulares
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

  -- Super admin da plataforma → tudo permitido
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

  -- Owner: tudo
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  -- Admin: tudo excepto transferência de propriedade e remoção do owner
  IF v_role = 'admin' THEN
    IF _cap IN ('settings.transfer_ownership','team.remove_owner') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  -- Manager: operacional completo, sem definições críticas nem transferências
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

  -- Reception: atendimento (agenda, clientes, viaturas, orçamentos, OS criar, faturas ver)
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

  -- Commercial: CRM/comercial puro
  IF v_role = 'commercial' THEN
    RETURN _cap IN (
      'dashboard.view',
      'clients.view','clients.create','clients.edit','clients.export',
      'vehicles.view','vehicles.create',
      'quotes.view','quotes.create','quotes.edit',
      'quotes.send_email','quotes.send_whatsapp','quotes.print',
      'agenda.view','chat.view','loyalty.view'
    );
  END IF;

  -- Technician: oficina apenas
  IF v_role = 'technician' THEN
    RETURN _cap IN (
      'dashboard.view',
      'work_orders.view','work_orders.edit','work_orders.complete',
      'vehicles.view',
      'agenda.view'
    );
  END IF;

  RETURN false;
END;
$$;

-- ============================================================
-- FASE 2 — POLÍTICAS RESTRICTIVE POR CAPACIDADE
-- (adicionam-se por cima das existentes; NÃO removem as PERMISSIVE de shop_id)
-- ============================================================

-- CLIENTS ----------------------------------------------------------------
DROP POLICY IF EXISTS "clients_role_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_role_update" ON public.clients;
DROP POLICY IF EXISTS "clients_role_delete" ON public.clients;

CREATE POLICY "clients_role_insert" ON public.clients
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'clients.create'));

CREATE POLICY "clients_role_update" ON public.clients
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'clients.edit'))
  WITH CHECK (public.has_capability(shop_id, 'clients.edit'));

CREATE POLICY "clients_role_delete" ON public.clients
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'clients.delete'));

-- VEHICLES ---------------------------------------------------------------
DROP POLICY IF EXISTS "vehicles_role_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_role_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_role_delete" ON public.vehicles;

CREATE POLICY "vehicles_role_insert" ON public.vehicles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'vehicles.create'));

CREATE POLICY "vehicles_role_update" ON public.vehicles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'vehicles.edit'))
  WITH CHECK (public.has_capability(shop_id, 'vehicles.edit'));

CREATE POLICY "vehicles_role_delete" ON public.vehicles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'vehicles.delete'));

-- QUOTES -----------------------------------------------------------------
DROP POLICY IF EXISTS "quotes_role_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_role_update" ON public.quotes;
DROP POLICY IF EXISTS "quotes_role_delete" ON public.quotes;

CREATE POLICY "quotes_role_insert" ON public.quotes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'quotes.create'));

CREATE POLICY "quotes_role_update" ON public.quotes
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'quotes.edit'))
  WITH CHECK (public.has_capability(shop_id, 'quotes.edit'));

CREATE POLICY "quotes_role_delete" ON public.quotes
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'quotes.delete'));

-- WORK_ORDERS ------------------------------------------------------------
DROP POLICY IF EXISTS "work_orders_role_insert" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_role_update" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_role_delete" ON public.work_orders;

CREATE POLICY "work_orders_role_insert" ON public.work_orders
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'work_orders.create'));

CREATE POLICY "work_orders_role_update" ON public.work_orders
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.edit'))
  WITH CHECK (public.has_capability(shop_id, 'work_orders.edit'));

CREATE POLICY "work_orders_role_delete" ON public.work_orders
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'work_orders.delete'));

-- INVOICES ---------------------------------------------------------------
DROP POLICY IF EXISTS "invoices_role_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_role_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_role_delete" ON public.invoices;

CREATE POLICY "invoices_role_insert" ON public.invoices
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'invoices.create'));

CREATE POLICY "invoices_role_update" ON public.invoices
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'invoices.create') OR public.has_capability(shop_id, 'invoices.cancel'))
  WITH CHECK (public.has_capability(shop_id, 'invoices.create') OR public.has_capability(shop_id, 'invoices.cancel'));

CREATE POLICY "invoices_role_delete" ON public.invoices
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'invoices.cancel'));

-- PAYMENTS (INSERT/UPDATE/DELETE — SELECT já protegido antes) --------------
DROP POLICY IF EXISTS "payments_role_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_role_update" ON public.payments;
DROP POLICY IF EXISTS "payments_role_delete" ON public.payments;

CREATE POLICY "payments_role_insert" ON public.payments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(shop_id, 'finance.view_costs'));

CREATE POLICY "payments_role_update" ON public.payments
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_capability(shop_id, 'finance.view_costs'))
  WITH CHECK (public.has_capability(shop_id, 'finance.view_costs'));

CREATE POLICY "payments_role_delete" ON public.payments
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_capability(shop_id, 'finance.view_costs'));