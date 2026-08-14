DO $$
DECLARE t text;
  unused text[] := ARRAY['automation_rules','campaigns','carity_listing_translations','chat_messages','crm_meetings','crm_notes','crm_objectives','crm_tasks','invoice_items','listing_views','market_escrow','message_templates','plan_limits_catalog','sale_confirmations','service_catalog','service_reminders','user_activity','work_order_attachments','work_order_times','listing_favorites'];
  needed text[] := ARRAY['gsn_notifications','shop_wallets','shop_wallet_transactions','support_tickets','legal_settings','pilot_leads','system_features','parts_orders','payments','notifications'];
BEGIN
  FOREACH t IN ARRAY unused LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY needed LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;