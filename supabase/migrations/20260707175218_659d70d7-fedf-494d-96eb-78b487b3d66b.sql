DROP POLICY IF EXISTS "Authenticated read document pdfs" ON storage.objects;
CREATE POLICY "Authenticated read document pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'document-pdfs');

DROP POLICY IF EXISTS "Authenticated upload document pdfs" ON storage.objects;
CREATE POLICY "Authenticated upload document pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'document-pdfs');

DROP POLICY IF EXISTS "Authenticated update document pdfs" ON storage.objects;
CREATE POLICY "Authenticated update document pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'document-pdfs');

DROP POLICY IF EXISTS "Authenticated delete document pdfs" ON storage.objects;
CREATE POLICY "Authenticated delete document pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'document-pdfs');