ALTER TABLE public.inspection_checklists
  ADD COLUMN IF NOT EXISTS public_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_viewed_at timestamptz;

UPDATE public.inspection_checklists SET public_token = gen_random_uuid() WHERE public_token IS NULL;

CREATE OR REPLACE FUNCTION public.get_public_inspection(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ic.id,
    'items', ic.items,
    'technician', ic.technician,
    'completed_at', ic.completed_at,
    'created_at', ic.created_at,
    'shared_at', ic.shared_at,
    'shop', jsonb_build_object(
      'name', s.name,
      'phone', s.phone,
      'email', s.email,
      'address', s.address,
      'logo_url', s.logo_url,
      'country_code', s.country_code
    ),
    'vehicle', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
      'make', v.make, 'model', v.model, 'plate', v.plate, 'year', v.year
    ) END,
    'work_order_number', wo.number
  )
  INTO result
  FROM public.inspection_checklists ic
  JOIN public.shops s ON s.id = ic.shop_id
  LEFT JOIN public.work_orders wo ON wo.id = ic.work_order_id
  LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
  WHERE ic.public_token = _token
    AND ic.shared_at IS NOT NULL;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_inspection(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_inspection(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_public_inspection_viewed(_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.inspection_checklists
     SET client_viewed_at = COALESCE(client_viewed_at, now())
   WHERE public_token = _token AND shared_at IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.mark_public_inspection_viewed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_public_inspection_viewed(uuid) TO anon, authenticated;