CREATE OR REPLACE FUNCTION public.shop_exists_for_public_booking(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops sh
    WHERE sh.id = _shop_id
      AND TRIM(COALESCE(sh.name, '')) <> ''
  )
$$;

GRANT EXECUTE ON FUNCTION public.shop_exists_for_public_booking(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments"
ON public.appointments
FOR INSERT
TO anon
WITH CHECK (
  status = 'pending'
  AND source = 'public'
  AND public.shop_exists_for_public_booking(shop_id)
);

GRANT INSERT ON public.appointments TO anon;