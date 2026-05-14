CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  email text,
  realm text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  blocked boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time
  ON public.signup_attempts (ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_email_time
  ON public.signup_attempts (email, attempted_at DESC);

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

-- Locked down: no anon/auth access. Only service_role (edge function) writes.
CREATE POLICY "no_select" ON public.signup_attempts FOR SELECT USING (false);
CREATE POLICY "no_insert" ON public.signup_attempts FOR INSERT WITH CHECK (false);

-- Rate-limit check: returns true if request should be ALLOWED, false if BLOCKED.
CREATE OR REPLACE FUNCTION public.check_signup_rate_limit(
  _ip text,
  _email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ip_count int;
  email_count int;
BEGIN
  IF _ip IS NOT NULL THEN
    SELECT count(*) INTO ip_count
    FROM public.signup_attempts
    WHERE ip_address = _ip
      AND attempted_at > now() - INTERVAL '1 hour';
    IF ip_count >= 5 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'too_many_from_ip', 'retry_after_minutes', 60);
    END IF;
  END IF;

  IF _email IS NOT NULL THEN
    SELECT count(*) INTO email_count
    FROM public.signup_attempts
    WHERE email = lower(_email)
      AND attempted_at > now() - INTERVAL '24 hours';
    IF email_count >= 3 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'too_many_for_email', 'retry_after_minutes', 1440);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_signup_rate_limit(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_signup_rate_limit(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_old_signup_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.signup_attempts WHERE attempted_at < now() - INTERVAL '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_signup_attempts() FROM anon, public;