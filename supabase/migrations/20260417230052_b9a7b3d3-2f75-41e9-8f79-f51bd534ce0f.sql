
-- 1) Update default split: oficina 14€, GarageFlow 10,90€
ALTER TABLE public.carity_inspections
  ALTER COLUMN shop_share SET DEFAULT 14.00,
  ALTER COLUMN platform_share SET DEFAULT 10.90;

-- Backfill any pending inspection still using old split (only those not yet paid out)
UPDATE public.carity_inspections
SET shop_share = 14.00, platform_share = 10.90
WHERE shop_share = 16.18 AND platform_share = 8.72;

-- 2) Wallet transactions history table
CREATE TABLE IF NOT EXISTS public.shop_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inspection_id uuid REFERENCES public.carity_inspections(id) ON DELETE SET NULL,
  payout_id uuid REFERENCES public.shop_payouts(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'credit', -- credit | payout | adjustment
  amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members view own wallet tx" ON public.shop_wallet_transactions;
CREATE POLICY "Shop members view own wallet tx" ON public.shop_wallet_transactions
  FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin manage wallet tx" ON public.shop_wallet_transactions;
CREATE POLICY "Super admin manage wallet tx" ON public.shop_wallet_transactions
  FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_swt_shop ON public.shop_wallet_transactions(shop_id, created_at DESC);

-- 3) Trigger: auto-credit wallet when inspection completes
CREATE OR REPLACE FUNCTION public.credit_shop_wallet_on_inspection_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.payment_status = 'paid' THEN
    share := COALESCE(NEW.shop_share, 14.00);

    -- Ensure wallet exists
    INSERT INTO public.shop_wallets (shop_id, balance, total_earned)
    VALUES (NEW.shop_id, 0, 0)
    ON CONFLICT (shop_id) DO NOTHING;

    -- Credit balance
    UPDATE public.shop_wallets
    SET balance = balance + share,
        total_earned = total_earned + share,
        updated_at = now()
    WHERE shop_id = NEW.shop_id;

    -- Log transaction
    INSERT INTO public.shop_wallet_transactions (shop_id, inspection_id, type, amount, description)
    VALUES (NEW.shop_id, NEW.id, 'credit', share,
      'Inspeção Market concluída #' || substr(NEW.id::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_wallet_inspection ON public.carity_inspections;
CREATE TRIGGER trg_credit_wallet_inspection
  AFTER UPDATE ON public.carity_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_shop_wallet_on_inspection_complete();

-- 4) Request payout (oficina)
CREATE OR REPLACE FUNCTION public.request_shop_payout(_shop_id uuid, _amount numeric, _method text DEFAULT 'bank_transfer', _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
  payout_id uuid;
BEGIN
  -- Permission: must be member of the shop
  IF NOT (_shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _amount IS NULL OR _amount < 20 THEN
    RAISE EXCEPTION 'min_payout_20_eur';
  END IF;

  SELECT balance INTO current_balance FROM public.shop_wallets WHERE shop_id = _shop_id;
  IF current_balance IS NULL OR current_balance < _amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Reserve funds (subtract immediately to prevent double request)
  UPDATE public.shop_wallets SET balance = balance - _amount, updated_at = now() WHERE shop_id = _shop_id;

  INSERT INTO public.shop_payouts (shop_id, amount, method, status, notes)
  VALUES (_shop_id, _amount, _method, 'pending', _notes)
  RETURNING id INTO payout_id;

  INSERT INTO public.shop_wallet_transactions (shop_id, payout_id, type, amount, description)
  VALUES (_shop_id, payout_id, 'payout_request', -_amount, 'Pedido de levantamento');

  RETURN payout_id;
END;
$$;

-- 5) Mark payout paid (admin)
CREATE OR REPLACE FUNCTION public.mark_shop_payout_paid(_payout_id uuid, _reference text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_shop uuid;
  p_amount numeric;
  p_status text;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT shop_id, amount, status INTO p_shop, p_amount, p_status
  FROM public.shop_payouts WHERE id = _payout_id;

  IF p_shop IS NULL THEN RAISE EXCEPTION 'payout_not_found'; END IF;
  IF p_status = 'paid' THEN RAISE EXCEPTION 'already_paid'; END IF;

  UPDATE public.shop_payouts
  SET status = 'paid', paid_at = now(), reference = COALESCE(_reference, reference)
  WHERE id = _payout_id;

  UPDATE public.shop_wallets
  SET total_paid = total_paid + p_amount, updated_at = now()
  WHERE shop_id = p_shop;

  INSERT INTO public.shop_wallet_transactions (shop_id, payout_id, type, amount, description)
  VALUES (p_shop, _payout_id, 'payout_paid', 0, 'Levantamento pago' || COALESCE(' (ref: ' || _reference || ')', ''));
END;
$$;

-- 6) Reject payout (admin) — restores balance
CREATE OR REPLACE FUNCTION public.reject_shop_payout(_payout_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_shop uuid;
  p_amount numeric;
  p_status text;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT shop_id, amount, status INTO p_shop, p_amount, p_status
  FROM public.shop_payouts WHERE id = _payout_id;

  IF p_shop IS NULL THEN RAISE EXCEPTION 'payout_not_found'; END IF;
  IF p_status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;

  UPDATE public.shop_payouts SET status = 'rejected', notes = COALESCE(notes, '') || E'\nRejeitado: ' || COALESCE(_reason, '') WHERE id = _payout_id;

  -- Restore balance
  UPDATE public.shop_wallets SET balance = balance + p_amount, updated_at = now() WHERE shop_id = p_shop;

  INSERT INTO public.shop_wallet_transactions (shop_id, payout_id, type, amount, description)
  VALUES (p_shop, _payout_id, 'payout_rejected', p_amount, 'Levantamento rejeitado — saldo devolvido');
END;
$$;
