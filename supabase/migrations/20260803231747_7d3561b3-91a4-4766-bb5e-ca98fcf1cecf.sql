CREATE OR REPLACE FUNCTION public.expire_trials_job()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  WITH updated AS (
    UPDATE public.subscriptions
       SET status = 'trial_expired',
           updated_at = now()
     WHERE status IN ('trialing', 'active')
       AND trial_end IS NOT NULL
       AND trial_end < now()
       AND stripe_subscription_id IS NULL
    RETURNING id
  )
  SELECT count(*) INTO _count FROM updated;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_trials_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_trials_job() TO service_role;

SELECT cron.unschedule('expire-trials-daily');

SELECT cron.schedule(
  'expire-trials-daily',
  '0 3 * * *',
  $cron$SELECT public.expire_trials_job();$cron$
);