
-- Add revenue_type to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS revenue_type text NOT NULL DEFAULT 'free';

-- Backfill existing data
UPDATE public.subscriptions SET revenue_type = 'free' WHERE plan = 'free';
UPDATE public.subscriptions SET revenue_type = 'trial' WHERE status = 'trialing' AND plan != 'free';
UPDATE public.subscriptions SET revenue_type = 'stripe_paid' WHERE stripe_subscription_id IS NOT NULL AND status = 'active' AND plan != 'free';
UPDATE public.subscriptions SET revenue_type = 'manual_admin' WHERE stripe_subscription_id IS NULL AND status = 'active' AND plan != 'free';

-- Add stripe_verified to carity_transactions
ALTER TABLE public.carity_transactions
ADD COLUMN IF NOT EXISTS stripe_verified boolean NOT NULL DEFAULT false;

-- Backfill: mark transactions with stripe_payment_id as verified
UPDATE public.carity_transactions SET stripe_verified = true WHERE stripe_payment_id IS NOT NULL AND stripe_payment_id != '';

-- Add stripe_verified to carity_boosts
ALTER TABLE public.carity_boosts
ADD COLUMN IF NOT EXISTS stripe_verified boolean NOT NULL DEFAULT false;

-- Backfill: mark boosts with stripe_session_id as verified
UPDATE public.carity_boosts SET stripe_verified = true WHERE stripe_session_id IS NOT NULL AND stripe_session_id != '';
