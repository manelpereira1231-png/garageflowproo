ALTER TABLE public.gsn_carriers REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gsn_carriers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;