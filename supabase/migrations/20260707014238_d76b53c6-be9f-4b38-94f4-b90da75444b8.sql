
-- 1) admin_coupons: remover leitura ampla por utilizadores autenticados.
DROP POLICY IF EXISTS "Authenticated read active coupons by code" ON public.admin_coupons;
REVOKE SELECT ON public.admin_coupons FROM anon;
-- Mantém SELECT para authenticated apenas para super admins via policy existente.

-- 2) carity_inspection_reports: remover leitura pública direta e expor via view segura.
DROP POLICY IF EXISTS "Public read reports of published listings" ON public.carity_inspection_reports;

-- View pública com colunas seguras apenas para listings publicados.
CREATE OR REPLACE VIEW public.carity_inspection_reports_public
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  r.id,
  r.listing_id,
  r.shop_id,
  r.inspection_id,
  r.overall_score,
  r.recommendation,
  r.defects,
  r.exterior_photos,
  r.interior_photos,
  r.engine_photos,
  r.tire_photos,
  r.brakes_photos,
  r.suspension_photos,
  r.damage_photos,
  r.inspector_notes,
  r.technician_name,
  r.mileage_at_inspection,
  r.is_locked,
  r.engine_status,
  r.transmission_status,
  r.brakes_status,
  r.suspension_status,
  r.steering_status,
  r.tires_status,
  r.electrical_status,
  r.inspection_city,
  r.inspection_country,
  r.inspection_lat,
  r.inspection_lng,
  r.completed_at,
  r.created_at
FROM public.carity_inspection_reports r
JOIN public.carity_listings l ON l.id = r.listing_id
WHERE l.status = 'published';

GRANT SELECT ON public.carity_inspection_reports_public TO anon, authenticated;
