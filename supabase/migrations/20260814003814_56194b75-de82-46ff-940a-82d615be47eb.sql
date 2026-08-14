-- 1. Deduplicate pending service reminders (keep the oldest per vehicle+type)
DELETE FROM public.service_reminders sr
USING public.service_reminders keep
WHERE sr.status = 'pending'
  AND keep.status = 'pending'
  AND sr.vehicle_id IS NOT NULL
  AND keep.vehicle_id = sr.vehicle_id
  AND coalesce(keep.service_type,'') = coalesce(sr.service_type,'')
  AND (keep.created_at, keep.id) < (sr.created_at, sr.id);

CREATE UNIQUE INDEX IF NOT EXISTS service_reminders_pending_uidx
  ON public.service_reminders (vehicle_id, coalesce(service_type,''))
  WHERE status = 'pending' AND vehicle_id IS NOT NULL;

-- 2. Pagination / search indexes
CREATE INDEX IF NOT EXISTS idx_clients_shop_created
  ON public.clients (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_created
  ON public.invoices (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_search_trgm
  ON public.clients USING gin (
    (coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(nif,'') || ' ' || coalesce(company,'')) gin_trgm_ops
  );
CREATE INDEX IF NOT EXISTS idx_vehicles_search_trgm
  ON public.vehicles USING gin (
    (coalesce(plate,'') || ' ' || coalesce(make,'') || ' ' || coalesce(model,'') || ' ' || coalesce(vin,'')) gin_trgm_ops
  );

-- 3. Revoke anon EXECUTE on internal helper functions
REVOKE EXECUTE ON FUNCTION public.get_user_shop_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_is_shop_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.group_shop_counts(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_work_order_parts(uuid, jsonb, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_user_shop_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_is_shop_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.group_shop_counts(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_work_order_parts(uuid, jsonb, text) TO authenticated, service_role;