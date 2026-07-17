-- Enterprise realtime: ensure core ERP + Marketplace tables broadcast changes.
-- Adds each table to supabase_realtime; ignore if already present.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients','vehicles','parts','carity_boosts','listing_favorites',
    'listing_views','carity_listing_translations','campaigns',
    'automation_rules','plan_country_prices','country_settings',
    'system_feature_flags','plan_limits_catalog','plan_promotions',
    'warranties','service_reminders','service_catalog','work_order_times',
    'work_order_attachments','marketplace_activation_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END$$;

-- Ensure REPLICA IDENTITY FULL on all realtime tables (so UPDATE/DELETE payloads
-- carry the row's old values, which the client needs for cache reconciliation).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I REPLICA IDENTITY FULL', r.schemaname, r.tablename);
  END LOOP;
END$$;