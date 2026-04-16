-- ============================================
-- 1. ANTI-FRAUDE: Bloquear VIN duplicado
-- ============================================

CREATE OR REPLACE FUNCTION public.check_duplicate_vin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas valida se o VIN está preenchido e o anúncio está ativo (publicado, em pagamento ou pendente)
  IF NEW.vin IS NOT NULL AND length(trim(NEW.vin)) >= 11 AND NEW.status IN ('published', 'pending_payment', 'pending_inspection', 'inspection_in_progress', 'reserved') THEN
    IF EXISTS (
      SELECT 1 FROM public.carity_listings
      WHERE vin = NEW.vin
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('published', 'pending_payment', 'pending_inspection', 'inspection_in_progress', 'reserved')
    ) THEN
      RAISE EXCEPTION 'VIN_DUPLICATE: Já existe um anúncio ativo com este VIN. Cada veículo só pode ter um anúncio ativo.'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_duplicate_vin ON public.carity_listings;
CREATE TRIGGER trg_check_duplicate_vin
  BEFORE INSERT OR UPDATE OF vin, status ON public.carity_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_duplicate_vin();

-- Índice para acelerar a verificação
CREATE INDEX IF NOT EXISTS idx_carity_listings_vin_active 
  ON public.carity_listings(vin) 
  WHERE status IN ('published', 'pending_payment', 'pending_inspection', 'inspection_in_progress', 'reserved');

-- ============================================
-- 2. KYC: Campos de verificação do vendedor
-- ============================================

ALTER TABLE public.carity_seller_profiles
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'cc' CHECK (document_type IN ('cc', 'passport', 'driver_license')),
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_submitted' CHECK (kyc_status IN ('not_submitted', 'pending_review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;

-- ============================================
-- 3. CONTRATOS DE COMPRA/VENDA AUTOMÁTICOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.market_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  contract_number text NOT NULL UNIQUE,
  vehicle_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  contract_hash text,
  buyer_signed_at timestamptz,
  seller_signed_at timestamptz,
  signed_status text NOT NULL DEFAULT 'pending' CHECK (signed_status IN ('pending', 'buyer_signed', 'seller_signed', 'fully_signed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and seller view own contracts"
  ON public.market_contracts FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "System inserts contracts"
  ON public.market_contracts FOR INSERT
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Parties update own signature"
  ON public.market_contracts FOR UPDATE
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_market_contracts_escrow ON public.market_contracts(escrow_id);
CREATE INDEX IF NOT EXISTS idx_market_contracts_buyer ON public.market_contracts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_market_contracts_seller ON public.market_contracts(seller_id);

-- ============================================
-- 4. ALERTAS DE NOVOS CARROS PARA COMPRADORES
-- ============================================

CREATE TABLE IF NOT EXISTS public.listing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  make text,
  model text,
  max_price numeric,
  min_year integer,
  max_mileage integer,
  fuel text,
  active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alerts"
  ON public.listing_alerts FOR ALL
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_listing_alerts_user ON public.listing_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_alerts_active ON public.listing_alerts(active) WHERE active = true;