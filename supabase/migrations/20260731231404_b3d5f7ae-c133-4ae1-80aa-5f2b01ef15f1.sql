
-- 1) SUBSCRIPTIONS: remove client write access entirely
DROP POLICY IF EXISTS "Shop owners manage subscriptions" ON public.subscriptions;

CREATE POLICY "Super admins manage subscriptions"
ON public.subscriptions FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.subscriptions FROM authenticated;
REVOKE ALL ON public.subscriptions FROM anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- 2) MANUAL PAYOUTS: no anon access at all
REVOKE ALL ON public.manual_payouts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_payouts TO authenticated;
GRANT ALL ON public.manual_payouts TO service_role;

-- 3) SHOPS: protect Stripe/billing-controlled columns from client writes
CREATE OR REPLACE FUNCTION public.protect_shop_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions / webhooks) and super admins may change these
  IF current_setting('request.jwt.claims', true) IS NULL
     OR coalesce(current_setting('request.jwt.claims', true)::json->>'role','') = 'service_role'
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.stripe_account_id                := OLD.stripe_account_id;
  NEW.stripe_connect_charges_enabled   := OLD.stripe_connect_charges_enabled;
  NEW.stripe_connect_payouts_enabled   := OLD.stripe_connect_payouts_enabled;
  NEW.stripe_connect_details_submitted := OLD.stripe_connect_details_submitted;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_shop_billing_columns_trg ON public.shops;
CREATE TRIGGER protect_shop_billing_columns_trg
BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.protect_shop_billing_columns();
