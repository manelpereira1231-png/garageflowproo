ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['active','trialing','past_due','canceled','cancelled','incomplete','expired','trial_expired']));

-- Backfill: any shop that already had a trial must be registered so it can never get a second one.
INSERT INTO public.trial_records (user_id, shop_id, email, nif, phone, stripe_customer_id, trial_start, trial_end)
SELECT s.user_id, s.id, COALESCE(u.email, s.id::text||'@backfill.local'), s.nif, s.phone, sub.stripe_customer_id,
       COALESCE(sub.trial_end - interval '30 days', sub.created_at), sub.trial_end
FROM public.subscriptions sub
JOIN public.shops s ON s.id = sub.shop_id
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE sub.trial_end IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.trial_records t WHERE t.shop_id = sub.shop_id);

CREATE OR REPLACE FUNCTION public.check_trial_eligibility(
  _email text,
  _nif text DEFAULT NULL::text,
  _phone text DEFAULT NULL::text,
  _stripe_customer_id text DEFAULT NULL::text,
  _shop_id uuid DEFAULT NULL::uuid,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trial_records WHERE lower(email) = lower(_email)) THEN
    RETURN false;
  END IF;

  IF _shop_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE shop_id = _shop_id) THEN
      RETURN false;
    END IF;
    -- Any past or present trial on the subscription itself also disqualifies.
    IF EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE shop_id = _shop_id AND (trial_end IS NOT NULL OR status = 'trialing')
    ) THEN
      RETURN false;
    END IF;
  END IF;

  IF _user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE user_id = _user_id) THEN
      RETURN false;
    END IF;
  END IF;

  IF _nif IS NOT NULL AND _nif <> '' THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE lower(nif) = lower(_nif)) THEN
      RETURN false;
    END IF;
  END IF;

  IF _phone IS NOT NULL AND _phone <> '' THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE phone = _phone) THEN
      RETURN false;
    END IF;
  END IF;

  IF _stripe_customer_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE stripe_customer_id = _stripe_customer_id) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$function$;