-- Drop the old status check and add a more permissive one
ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'cancelled'::text, 'incomplete'::text, 'expired'::text]));

-- Fix any existing 'cancelled' entries to use 'canceled' for consistency
UPDATE public.subscriptions SET status = 'canceled' WHERE status = 'cancelled';