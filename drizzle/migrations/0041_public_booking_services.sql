CREATE OR REPLACE FUNCTION public.get_public_booking_services(_shop_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sc.id, sc.name FROM public.service_catalog sc
  WHERE sc.shop_id = _shop_id AND COALESCE(sc.active, true)
  ORDER BY sc.name LIMIT 500
$$;
GRANT EXECUTE ON FUNCTION public.get_public_booking_services(uuid) TO anon, authenticated;