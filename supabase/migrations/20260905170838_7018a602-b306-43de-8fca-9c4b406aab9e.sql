DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.complaints'::regclass AND tgname = 'tg_complaints_set_sla'
  ) THEN
    CREATE TRIGGER tg_complaints_set_sla
      BEFORE INSERT ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_set_sla();
  END IF;
END $$;