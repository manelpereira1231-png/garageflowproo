-- P1: fix cross-shop data leak on storage bucket "document-pdfs".
-- Previous policies allowed ANY authenticated user to SELECT / UPDATE / DELETE
-- objects in this bucket regardless of shop_id, and to INSERT anywhere.
-- Path convention is "{shop_id}/invoices/{invoice_id}/{file}.pdf" — scope every
-- operation to the shop_ids the caller belongs to via get_user_shop_ids().

DROP POLICY IF EXISTS "Authenticated read document pdfs"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload document pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update document pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete document pdfs" ON storage.objects;

CREATE POLICY "Shop members read document pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT get_user_shop_ids(auth.uid())::text
  )
);

CREATE POLICY "Shop members upload document pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT get_user_shop_ids(auth.uid())::text
  )
);

CREATE POLICY "Shop members update document pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT get_user_shop_ids(auth.uid())::text
  )
)
WITH CHECK (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT get_user_shop_ids(auth.uid())::text
  )
);

CREATE POLICY "Shop members delete document pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT get_user_shop_ids(auth.uid())::text
  )
);