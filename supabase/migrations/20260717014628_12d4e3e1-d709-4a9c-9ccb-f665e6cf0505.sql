
-- 1) carity_boosts: prevent sellers self-activating paid boosts
DROP POLICY IF EXISTS "Sellers manage own boosts" ON public.carity_boosts;

CREATE POLICY "Sellers view own boosts"
  ON public.carity_boosts FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers insert own pending boosts"
  ON public.carity_boosts FOR INSERT
  WITH CHECK (
    seller_id = auth.uid()
    AND status = 'pending'
    AND stripe_verified = false
    AND started_at IS NULL
    AND expires_at IS NULL
  );

CREATE POLICY "Sellers update own pending boosts"
  ON public.carity_boosts FOR UPDATE
  USING (seller_id = auth.uid() AND stripe_verified = false AND status = 'pending')
  WITH CHECK (
    seller_id = auth.uid()
    AND stripe_verified = false
    AND status IN ('pending', 'cancelled')
    AND started_at IS NULL
    AND expires_at IS NULL
  );

CREATE POLICY "Sellers delete own pending boosts"
  ON public.carity_boosts FOR DELETE
  USING (seller_id = auth.uid() AND stripe_verified = false);

-- 2) market_escrow: buyers cannot fabricate paid/released transactions
DROP POLICY IF EXISTS "Buyers create escrows" ON public.market_escrow;

CREATE POLICY "Buyers create escrows"
  ON public.market_escrow FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND status = 'pending'
    AND stripe_verified = false
    AND captured_at IS NULL
    AND released_at IS NULL
    AND delivery_confirmed_at IS NULL
    AND refunded_at IS NULL
    AND disputed_at IS NULL
    AND resolved_at IS NULL
    AND resolved_by IS NULL
  );

-- 3) referrals: validate referrer matches referral code owner
DROP POLICY IF EXISTS "Users insert referrals" ON public.referrals;

CREATE POLICY "Users insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (
    referred_user_id = auth.uid()
    AND status = 'pending'
    AND payment_confirmed = false
    AND reward_given = false
    AND referrer_user_id IS NOT NULL
    AND referrer_user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.referral_codes rc
      WHERE rc.code = referrals.referral_code
        AND rc.user_id = referrals.referrer_user_id
    )
  );

-- 4) sale_confirmations: sellers cannot fake buyer confirmation
DROP POLICY IF EXISTS "Sellers insert own confirmations" ON public.sale_confirmations;
DROP POLICY IF EXISTS "Sellers update own confirmations" ON public.sale_confirmations;

CREATE POLICY "Sellers insert own confirmations"
  ON public.sale_confirmations FOR INSERT
  WITH CHECK (
    seller_id = auth.uid()
    AND buyer_confirmed = false
    AND confirmed_at IS NULL
  );

CREATE POLICY "Sellers update own confirmations"
  ON public.sale_confirmations FOR UPDATE
  USING (
    seller_id = auth.uid()
    AND buyer_confirmed = false
    AND confirmed_at IS NULL
  )
  WITH CHECK (
    seller_id = auth.uid()
    AND buyer_confirmed = false
    AND confirmed_at IS NULL
  );
