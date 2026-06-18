-- Enable Realtime on tables that drive in-app live updates.
-- Safe to run multiple times: each ADD TABLE is wrapped in a DO block
-- that ignores duplicates ("relation is already member of publication").

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'appointments',
    'alerts',
    'notifications',
    'work_orders',
    'quotes',
    'invoices',
    'invoice_items',
    'chat_messages',
    'parts_orders',
    'parts_order_items',
    'stock_movements',
    'sale_confirmations',
    'carity_chat_messages',
    'carity_offers',
    'carity_inspection_offers',
    'carity_inspections',
    'carity_listings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    -- REPLICA IDENTITY FULL so UPDATE/DELETE payloads contain the previous row,
    -- otherwise filtered subscriptions miss events when only some columns change.
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;