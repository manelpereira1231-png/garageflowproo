GRANT EXECUTE ON FUNCTION public.expire_trials_job() TO postgres;

DO $$
DECLARE n integer;
BEGIN
  n := public.expire_trials_job();
  RAISE NOTICE 'expired: %', n;
END $$;