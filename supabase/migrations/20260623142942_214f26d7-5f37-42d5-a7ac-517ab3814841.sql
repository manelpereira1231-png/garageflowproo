
-- 1. shops: hide stripe_connect_account_id from authenticated (only service_role)
REVOKE SELECT (stripe_connect_account_id) ON public.shops FROM authenticated;
REVOKE SELECT (stripe_connect_account_id) ON public.shops FROM anon;

-- 2. subscriptions: hide stripe_customer_id and stripe_subscription_id from authenticated
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.subscriptions FROM authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.subscriptions FROM anon;

-- 3. partners: hide api_key from authenticated (must go through SECURITY DEFINER RPC)
REVOKE SELECT (api_key) ON public.partners FROM authenticated;
REVOKE SELECT (api_key) ON public.partners FROM anon;

-- 4. sale_confirmations: split seller policy so buyer contact only visible after confirmed_at
DROP POLICY IF EXISTS "Sellers manage own confirmations" ON public.sale_confirmations;

CREATE POLICY "Sellers view own confirmations after confirmed"
ON public.sale_confirmations
FOR SELECT
TO authenticated
USING (seller_id = auth.uid() AND confirmed_at IS NOT NULL);

CREATE POLICY "Sellers insert own confirmations"
ON public.sale_confirmations
FOR INSERT
TO authenticated
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers update own confirmations"
ON public.sale_confirmations
FOR UPDATE
TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers delete own confirmations"
ON public.sale_confirmations
FOR DELETE
TO authenticated
USING (seller_id = auth.uid());
