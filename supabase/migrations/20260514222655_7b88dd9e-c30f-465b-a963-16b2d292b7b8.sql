-- Idempotency log for Stripe webhook events.
-- Stripe retries failed deliveries; without this table we may process the
-- same event multiple times (double plan activation, duplicate alerts, etc).
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

-- Auto-cleanup older than 30 days (Stripe retry window is ~3 days; 30d is generous).
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.stripe_webhook_events (processed_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service_role (used by the edge function) can read/write. No anon/authenticated access.
CREATE POLICY "service_role_only_select"
  ON public.stripe_webhook_events FOR SELECT
  USING (false);

CREATE POLICY "service_role_only_insert"
  ON public.stripe_webhook_events FOR INSERT
  WITH CHECK (false);

-- Optional janitor function to purge old rows (call from cron if desired).
CREATE OR REPLACE FUNCTION public.purge_old_stripe_webhook_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.stripe_webhook_events
  WHERE processed_at < now() - INTERVAL '30 days';
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_stripe_webhook_events() FROM anon, public;