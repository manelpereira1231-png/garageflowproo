
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments','crm_leads','crm_meetings','crm_tasks','crm_objectives','crm_notes','user_activity']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Ensure REPLICA IDENTITY FULL on already-published tables too (needed for UPDATE/DELETE payloads)
ALTER TABLE public.shops REPLICA IDENTITY FULL;
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
