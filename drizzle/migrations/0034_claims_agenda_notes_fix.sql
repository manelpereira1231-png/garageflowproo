DO $$ DECLARE src text; BEGIN
  src := pg_get_functiondef('public.sync_claim_agenda_events'::regproc);
  src := replace(src, '''Sinistro '' || COALESCE(NEW.claim_number,'''')', '''Sinistro'' || COALESCE('' '' || NULLIF(NEW.claim_number,''''),'''')');
  EXECUTE src;
END $$;
UPDATE public.claims SET process_number = process_number WHERE id IN (SELECT claim_id FROM public.appointments WHERE claim_id IS NOT NULL);