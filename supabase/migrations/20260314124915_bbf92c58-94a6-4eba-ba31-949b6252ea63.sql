
-- Allow authenticated users to read suppliers
DROP POLICY IF EXISTS "Super admin manage suppliers" ON public.suppliers;

CREATE POLICY "Authenticated users read suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin write suppliers"
  ON public.suppliers FOR ALL
  TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
