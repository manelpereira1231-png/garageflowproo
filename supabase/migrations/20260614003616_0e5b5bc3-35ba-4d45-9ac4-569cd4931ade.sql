
CREATE POLICY "marketing_creatives_super_admin_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'marketing-creatives' AND public.is_super_admin(auth.uid()));

CREATE POLICY "marketing_creatives_super_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-creatives' AND public.is_super_admin(auth.uid()));

CREATE POLICY "marketing_creatives_super_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing-creatives' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'marketing-creatives' AND public.is_super_admin(auth.uid()));

CREATE POLICY "marketing_creatives_super_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing-creatives' AND public.is_super_admin(auth.uid()));
