ALTER TABLE public.carity_seller_profiles
  ADD COLUMN IF NOT EXISTS dealer_stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS dealer_stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS dealer_stripe_price_id text,
  ADD COLUMN IF NOT EXISTS dealer_subscription_status text;

CREATE INDEX IF NOT EXISTS idx_seller_dealer_stripe_sub ON public.carity_seller_profiles(dealer_stripe_subscription_id);