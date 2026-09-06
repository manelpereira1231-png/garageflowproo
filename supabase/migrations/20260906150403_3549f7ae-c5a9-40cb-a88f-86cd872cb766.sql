-- Colunas de reembolso na fatura da plataforma
ALTER TABLE public.platform_invoices
  ADD COLUMN IF NOT EXISTS amount_refunded numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS refund_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_mismatch boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.platform_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  shop_id uuid,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending',
  reason text,
  notes text,
  stripe_refund_id text,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  idempotency_key text NOT NULL,
  requested_by uuid,
  requested_by_email text,
  error_message text,
  raw_status text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_refunds_idem_uidx ON public.platform_refunds (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS platform_refunds_stripe_uidx ON public.platform_refunds (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_refunds_invoice_idx ON public.platform_refunds (platform_invoice_id);

GRANT SELECT ON public.platform_refunds TO authenticated;
GRANT ALL ON public.platform_refunds TO service_role;

ALTER TABLE public.platform_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages platform refunds"
  ON public.platform_refunds FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Shops read own platform refunds"
  ON public.platform_refunds FOR SELECT TO authenticated
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.tg_platform_refunds_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS platform_refunds_touch ON public.platform_refunds;
CREATE TRIGGER platform_refunds_touch BEFORE UPDATE ON public.platform_refunds
FOR EACH ROW EXECUTE FUNCTION public.tg_platform_refunds_touch();

-- Recalcula o total reembolsado da fatura a partir dos reembolsos confirmados
CREATE OR REPLACE FUNCTION public.recalc_platform_invoice_refunds(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total numeric; _paid numeric; _status text;
BEGIN
  IF _invoice_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(amount),0) INTO _total FROM public.platform_refunds
    WHERE platform_invoice_id = _invoice_id AND status = 'succeeded';
  SELECT amount_total INTO _paid FROM public.platform_invoices WHERE id = _invoice_id;
  _status := CASE WHEN _total <= 0 THEN 'none'
                  WHEN _paid IS NOT NULL AND _total >= _paid - 0.005 THEN 'refunded'
                  ELSE 'partially_refunded' END;
  UPDATE public.platform_invoices
     SET amount_refunded = _total, refund_status = _status, updated_at = now()
   WHERE id = _invoice_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_platform_refunds_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_platform_invoice_refunds(COALESCE(NEW.platform_invoice_id, OLD.platform_invoice_id));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS platform_refunds_sync ON public.platform_refunds;
CREATE TRIGGER platform_refunds_sync AFTER INSERT OR UPDATE OR DELETE ON public.platform_refunds
FOR EACH ROW EXECUTE FUNCTION public.tg_platform_refunds_sync();