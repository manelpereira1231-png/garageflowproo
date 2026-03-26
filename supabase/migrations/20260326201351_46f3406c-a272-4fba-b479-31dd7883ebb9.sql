
-- Create dedicated private bucket for inspection files
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-files', 'inspection-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Shop members can upload inspection files
CREATE POLICY "Shop members upload inspection files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inspection-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.shops
    WHERE id IN (SELECT public.get_user_shop_ids(auth.uid()))
  )
);

-- RLS: Shop members can read their inspection files
CREATE POLICY "Shop members read inspection files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'inspection-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.shops
    WHERE id IN (SELECT public.get_user_shop_ids(auth.uid()))
  )
);

-- RLS: Shop members can delete their inspection files
CREATE POLICY "Shop members delete inspection files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'inspection-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.shops
    WHERE id IN (SELECT public.get_user_shop_ids(auth.uid()))
  )
);
