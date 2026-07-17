CREATE OR REPLACE FUNCTION public.get_user_shop_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Single source of truth for shop scope:
  -- - A group owner (Oficina Mãe) can access every shop in the group.
  -- - A child-shop owner can access only their own shop.
  -- - Team members can access only shops where they are explicitly assigned.
  SELECT sh.id
  FROM public.shops sh
  WHERE sh.group_owner_id = _user_id

  UNION

  SELECT sh.id
  FROM public.shops sh
  WHERE sh.user_id = _user_id

  UNION

  SELECT su.shop_id
  FROM public.shop_users su
  WHERE su.user_id = _user_id;
$function$;

CREATE OR REPLACE FUNCTION public.user_owns_shop(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.shops sh
    WHERE sh.id = _shop_id
      AND (sh.user_id = _user_id OR sh.group_owner_id = _user_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_is_shop_member(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.shops sh
    WHERE sh.id = _shop_id
      AND (sh.user_id = _user_id OR sh.group_owner_id = _user_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.shop_users su
    WHERE su.user_id = _user_id
      AND su.shop_id = _shop_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_shop_role(_shop_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_super_admin(auth.uid()) THEN 'super_admin'
    WHEN EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = _shop_id
        AND (sh.user_id = auth.uid() OR sh.group_owner_id = auth.uid())
    ) THEN 'owner'
    ELSE (
      SELECT su.role
      FROM public.shop_users su
      WHERE su.shop_id = _shop_id
        AND su.user_id = auth.uid()
      LIMIT 1
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.has_capability(_shop_id uuid, _cap text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF _shop_id IS NULL OR _cap IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin(auth.uid()) THEN RETURN true; END IF;

  -- The group owner / Oficina Mãe has owner-level capability across every
  -- shop in the group. A child owner only gets owner-level capability in the
  -- child shop where shops.user_id = auth.uid().
  IF EXISTS (
    SELECT 1
    FROM public.shops sh
    WHERE sh.id = _shop_id
      AND (sh.user_id = auth.uid() OR sh.group_owner_id = auth.uid())
  ) THEN
    RETURN true;
  END IF;

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
$function$;