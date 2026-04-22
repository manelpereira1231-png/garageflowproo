-- Schedule cron job to capture expired escrow PaymentIntents (48h satisfaction window)
-- Runs every hour and calls the market-escrow-cron-capture edge function
SELECT cron.schedule(
  'market-escrow-capture-48h',
  '0 * * * *', -- every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://ukizzadscugrooovymvv.supabase.co/functions/v1/market-escrow-cron-capture',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);