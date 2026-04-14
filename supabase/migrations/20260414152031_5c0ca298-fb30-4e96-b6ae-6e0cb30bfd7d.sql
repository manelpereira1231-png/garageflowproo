
-- Shop wallet for marketplace earnings
CREATE TABLE public.shop_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id)
);

ALTER TABLE public.shop_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members view own wallet"
ON public.shop_wallets FOR SELECT
USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Super admin manage wallets"
ON public.shop_wallets FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Shop payouts history
CREATE TABLE public.shop_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'bank_transfer',
  status text NOT NULL DEFAULT 'pending',
  reference text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members view own payouts"
ON public.shop_payouts FOR SELECT
USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Super admin manage payouts"
ON public.shop_payouts FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Sale confirmation (double confirmation)
CREATE TABLE public.sale_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  seller_confirmed boolean NOT NULL DEFAULT false,
  buyer_email text,
  buyer_phone text,
  buyer_confirmed boolean NOT NULL DEFAULT false,
  confirmation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_price numeric NOT NULL DEFAULT 0,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id)
);

ALTER TABLE public.sale_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own confirmations"
ON public.sale_confirmations FOR ALL
TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Public confirm via token"
ON public.sale_confirmations FOR SELECT
TO anon
USING (confirmation_token IS NOT NULL);

CREATE POLICY "Super admin manage confirmations"
ON public.sale_confirmations FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Add shop reputation fields
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS carity_inspections_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS carity_approval_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS carity_rating numeric NOT NULL DEFAULT 0;
