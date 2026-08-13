-- 1) get_user_shop_ids: só pode ser consultado sobre o próprio utilizador
CREATE OR REPLACE FUNCTION public.get_user_shop_ids(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH caller AS (
    SELECT (
      _user_id IS NOT NULL AND (
        _user_id = auth.uid()
        OR coalesce(auth.role(), '') = 'service_role'
        OR public.is_super_admin(auth.uid())
      )
    ) AS ok
  ),
  real_direct_shop AS (
    SELECT EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.user_id = _user_id AND trim(coalesce(sh.name, '')) <> ''
    ) AS exists_real
  ),
  real_member_shop AS (
    SELECT EXISTS (
      SELECT 1 FROM public.shop_users su
      JOIN public.shops sh ON sh.id = su.shop_id
      WHERE su.user_id = _user_id AND trim(coalesce(sh.name, '')) <> ''
    ) AS exists_real
  ),
  valid_group_owner AS (
    SELECT EXISTS (
      SELECT 1 FROM public.shops root
      WHERE root.group_owner_id = _user_id
        AND root.user_id = _user_id
        AND trim(coalesce(root.name, '')) <> ''
    ) AS is_valid
  )
  SELECT sh.id
  FROM public.shops sh, valid_group_owner vgo, caller c
  WHERE c.ok AND vgo.is_valid
    AND sh.group_owner_id = _user_id
    AND trim(coalesce(sh.name, '')) <> ''

  UNION

  SELECT sh.id
  FROM public.shops sh, real_direct_shop rds, real_member_shop rms, caller c
  WHERE c.ok AND sh.user_id = _user_id
    AND (
      trim(coalesce(sh.name, '')) <> ''
      OR (NOT rds.exists_real AND NOT rms.exists_real)
    )

  UNION

  SELECT su.shop_id
  FROM public.shop_users su
  JOIN public.shops sh ON sh.id = su.shop_id, caller c
  WHERE c.ok AND su.user_id = _user_id
    AND trim(coalesce(sh.name, '')) <> '';
$function$;

-- 2) Capability gates (RESTRICTIVE: somam-se às políticas de membership existentes)

-- email_logs: histórico de comunicações -> exige clients.view
DROP POLICY IF EXISTS email_logs_capability_guard ON public.email_logs;
CREATE POLICY email_logs_capability_guard ON public.email_logs
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'clients.view'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'clients.view'));

-- service_reminders: dados de clientes -> ver requer clients.view, escrever requer clients.edit
DROP POLICY IF EXISTS service_reminders_capability_guard ON public.service_reminders;
CREATE POLICY service_reminders_capability_guard ON public.service_reminders
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'clients.view'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'clients.edit'));

-- vehicle_global_history -> vehicles.view / vehicles.edit
DROP POLICY IF EXISTS vehicle_global_history_capability_guard ON public.vehicle_global_history;
CREATE POLICY vehicle_global_history_capability_guard ON public.vehicle_global_history
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'vehicles.view'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'vehicles.edit'));

-- document_series: configuração fiscal -> ver requer invoices.view, alterar requer settings.manage
DROP POLICY IF EXISTS document_series_capability_guard ON public.document_series;
CREATE POLICY document_series_capability_guard ON public.document_series
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'invoices.view'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_capability(shop_id, 'settings.manage'));

-- notifications: apenas o destinatário (ou responsáveis quando a notificação é da oficina)
DROP POLICY IF EXISTS notifications_recipient_guard ON public.notifications;
CREATE POLICY notifications_recipient_guard ON public.notifications
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR (user_id IS NULL AND public.has_capability(shop_id, 'dashboard.view'))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR (user_id IS NULL AND public.has_capability(shop_id, 'dashboard.view'))
);