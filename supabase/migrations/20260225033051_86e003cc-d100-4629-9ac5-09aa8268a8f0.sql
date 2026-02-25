-- Allow anon to SELECT quotes by token
CREATE POLICY "Public quote access by token"
ON public.quotes
FOR SELECT
TO anon
USING (token IS NOT NULL);

-- Allow anon to UPDATE quote status via token
CREATE POLICY "Public quote approval by token"
ON public.quotes
FOR UPDATE
TO anon
USING (token IS NOT NULL)
WITH CHECK (token IS NOT NULL);

-- Allow anon to read related clients for quote approval
CREATE POLICY "Public client access for quotes"
ON public.clients
FOR SELECT
TO anon
USING (
  id IN (SELECT client_id FROM public.quotes WHERE token IS NOT NULL)
);

-- Allow anon to read related vehicles for quote approval
CREATE POLICY "Public vehicle access for quotes"
ON public.vehicles
FOR SELECT
TO anon
USING (
  id IN (SELECT vehicle_id FROM public.quotes WHERE token IS NOT NULL)
);

-- Allow anon to read shop info for quote approval
CREATE POLICY "Public shop access for quotes"
ON public.shops
FOR SELECT
TO anon
USING (
  id IN (SELECT shop_id FROM public.quotes WHERE token IS NOT NULL)
);