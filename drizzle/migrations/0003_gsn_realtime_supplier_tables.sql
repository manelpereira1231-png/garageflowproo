ALTER TABLE public.gsn_products REPLICA IDENTITY FULL;
ALTER TABLE public.gsn_payments REPLICA IDENTITY FULL;
ALTER TABLE public.gsn_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.gsn_orders REPLICA IDENTITY FULL;
ALTER TABLE public.gsn_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.gsn_stock_movements REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gsn_products','gsn_payments','gsn_invoices','gsn_orders','gsn_reviews','gsn_stock_movements']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;