CREATE TABLE public.claim_billing_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric,
  payer text NOT NULL DEFAULT 'insurer',
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_billing_lines_payer_chk CHECK (payer IN ('insurer','client'))
);
CREATE INDEX claim_billing_lines_claim_idx ON public.claim_billing_lines(claim_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_billing_lines TO authenticated;
GRANT ALL ON public.claim_billing_lines TO service_role;
ALTER TABLE public.claim_billing_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage claim billing lines" ON public.claim_billing_lines
FOR ALL TO authenticated
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));
-- Linha já faturada não pode ser alterada nem apagada (exceto desligar ao anular).
CREATE OR REPLACE FUNCTION public.claim_billing_line_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN RAISE EXCEPTION 'Linha já faturada'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS NOT NULL THEN
    IF NEW.invoice_id <> OLD.invoice_id OR NEW.description <> OLD.description OR NEW.quantity <> OLD.quantity
       OR NEW.unit_price <> OLD.unit_price OR NEW.payer <> OLD.payer THEN
      RAISE EXCEPTION 'Linha já faturada';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER claim_billing_lines_lock BEFORE UPDATE OR DELETE ON public.claim_billing_lines
FOR EACH ROW EXECUTE FUNCTION public.claim_billing_line_lock();