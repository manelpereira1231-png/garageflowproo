DROP POLICY IF EXISTS "complaints insert auth" ON public.complaints;
CREATE POLICY "complaints insert auth" ON public.complaints FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "complaints_admin_update" ON public.gsn_complaints;
CREATE POLICY "complaints_admin_update" ON public.gsn_complaints FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = gsn_complaints.supplier_id AND s.owner_user_id = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = gsn_complaints.supplier_id AND s.owner_user_id = auth.uid()));