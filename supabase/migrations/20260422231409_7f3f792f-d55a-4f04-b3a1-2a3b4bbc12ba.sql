-- Sellers (carity_seller_profiles) — Connect Express
ALTER TABLE public.carity_seller_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_carity_seller_profiles_connect_account
  ON public.carity_seller_profiles(stripe_connect_account_id);

-- Shops — Connect Express (oficinas)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_shops_connect_account
  ON public.shops(stripe_connect_account_id);

-- Market escrow — campos de auditoria Connect
ALTER TABLE public.market_escrow
  ADD COLUMN IF NOT EXISTS capture_method text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS application_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_id text,
  ADD COLUMN IF NOT EXISTS captured_at timestamp with time zone;