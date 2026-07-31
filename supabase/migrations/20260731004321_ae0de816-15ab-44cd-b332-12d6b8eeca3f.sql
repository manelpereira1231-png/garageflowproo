CREATE TABLE public.saft_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  storage_path text,
  filename text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

GRANT SELECT, INSERT ON public.saft_export_jobs TO authenticated;
GRANT ALL ON public.saft_export_jobs TO service_role;

ALTER TABLE public.saft_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members can view SAF-T export jobs"
ON public.saft_export_jobs FOR SELECT TO authenticated
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE POLICY "Shop members can request SAF-T exports"
ON public.saft_export_jobs FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND shop_id IN (SELECT public.get_user_shop_ids(auth.uid()))
);

CREATE INDEX saft_export_jobs_requester_created_idx
ON public.saft_export_jobs(requested_by, created_at DESC);
CREATE INDEX saft_export_jobs_shop_status_idx
ON public.saft_export_jobs(shop_id, status);

CREATE POLICY "Shop members can read their SAF-T files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'saft-exports'
  AND (storage.foldername(name))[1] IN (
    SELECT shop_id::text FROM public.saft_export_jobs
    WHERE requested_by = auth.uid()
  )
);

CREATE POLICY "Backend manages SAF-T files"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'saft-exports')
WITH CHECK (bucket_id = 'saft-exports');