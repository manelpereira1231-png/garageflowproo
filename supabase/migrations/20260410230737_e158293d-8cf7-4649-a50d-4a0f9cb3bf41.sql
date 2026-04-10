
-- Table to track trial usage for anti-fraud
CREATE TABLE public.trial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  email text NOT NULL,
  nif text,
  phone text,
  stripe_customer_id text,
  ip_address text,
  trial_start timestamptz NOT NULL DEFAULT now(),
  trial_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_trial_records_email ON public.trial_records (lower(email));
CREATE INDEX idx_trial_records_nif ON public.trial_records (lower(nif)) WHERE nif IS NOT NULL AND nif != '';
CREATE INDEX idx_trial_records_phone ON public.trial_records (phone) WHERE phone IS NOT NULL AND phone != '';
CREATE INDEX idx_trial_records_stripe ON public.trial_records (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_trial_records_user ON public.trial_records (user_id);

ALTER TABLE public.trial_records ENABLE ROW LEVEL SECURITY;

-- Only super admins can read trial records
CREATE POLICY "Super admin manage trial_records"
ON public.trial_records FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Security definer function to check trial eligibility (called from edge functions)
CREATE OR REPLACE FUNCTION public.check_trial_eligibility(
  _email text,
  _nif text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _stripe_customer_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check by email
  IF EXISTS (SELECT 1 FROM public.trial_records WHERE lower(email) = lower(_email)) THEN
    RETURN false;
  END IF;

  -- Check by NIF (company tax ID)
  IF _nif IS NOT NULL AND _nif != '' THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE lower(nif) = lower(_nif)) THEN
      RETURN false;
    END IF;
  END IF;

  -- Check by phone
  IF _phone IS NOT NULL AND _phone != '' THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE phone = _phone) THEN
      RETURN false;
    END IF;
  END IF;

  -- Check by Stripe customer
  IF _stripe_customer_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.trial_records WHERE stripe_customer_id = _stripe_customer_id) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;
