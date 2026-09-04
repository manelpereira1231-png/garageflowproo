DROP POLICY IF EXISTS "Public can create appointments (signed in)" ON public.appointments;
CREATE POLICY "Public can create appointments (signed in)"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND source = 'public'
  AND public.shop_exists_for_public_booking(shop_id)
);

DELETE FROM public.appointments WHERE client_name IN ('QA Teste','QA Teste2') AND source = 'public';