
-- 1) Replace shop-creation trigger: no auto trial anymore.
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- New shops start on the free plan. The 30-day trial is now ONLY granted
  -- by the Stripe checkout flow on first paid subscription, via
  -- check_trial_eligibility() / trial_records — no more auto-trial at signup.
  INSERT INTO public.subscriptions (shop_id, plan, status, trial_end, billing_cycle)
  VALUES (NEW.id, 'free', 'active', NULL, 'monthly');

  INSERT INTO public.shop_users (shop_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');

  RETURN NEW;
END;
$$;

-- 2) Clean up legacy fake trials: any 'trialing' subscription without a Stripe ID
--    is converted to plain free. Real Stripe trials (with stripe_subscription_id)
--    are left untouched.
UPDATE public.subscriptions
   SET plan = 'free',
       status = 'active',
       trial_end = NULL,
       updated_at = now()
 WHERE status = 'trialing'
   AND stripe_subscription_id IS NULL;
