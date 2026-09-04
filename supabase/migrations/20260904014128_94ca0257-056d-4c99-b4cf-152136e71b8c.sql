CREATE OR REPLACE FUNCTION public.protect_shop_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claims', true) IS NULL
     OR coalesce(current_setting('request.jwt.claims', true)::json->>'role','') = 'service_role'
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.stripe_connect_account_id       := OLD.stripe_connect_account_id;
  NEW.stripe_connect_charges_enabled  := OLD.stripe_connect_charges_enabled;
  NEW.stripe_connect_payouts_enabled  := OLD.stripe_connect_payouts_enabled;
  NEW.stripe_connect_onboarded        := OLD.stripe_connect_onboarded;
  RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_id)
);

GRANT SELECT, INSERT, DELETE ON public.admin_notification_reads TO authenticated;
GRANT ALL ON public.admin_notification_reads TO service_role;

ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their own notification reads"
ON public.admin_notification_reads
FOR ALL
TO authenticated
USING (user_id = auth.uid() AND public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.is_super_admin(auth.uid()));