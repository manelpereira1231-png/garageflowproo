
-- Legal invoice hardening: QR code column + immutability trigger after certification

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS certified_series TEXT,
  ADD COLUMN IF NOT EXISTS legal_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (legal_status IN ('draft','certified','cancelled'));

-- Backfill legal_status from existing data
UPDATE public.invoices
   SET legal_status = CASE
     WHEN cancelled_at IS NOT NULL THEN 'cancelled'
     WHEN provider_invoice_id IS NOT NULL OR atcud IS NOT NULL THEN 'certified'
     ELSE 'draft'
   END
 WHERE legal_status = 'draft';

-- Immutability trigger: once certified, block edits to fiscal fields
CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.legal_status = 'certified' THEN
    -- Allow only transitioning to 'cancelled' and setting credit note fields
    IF NEW.legal_status NOT IN ('certified','cancelled') THEN
      RAISE EXCEPTION 'Fatura certificada é imutável (art. 36º CIVA). Emita Nota de Crédito para anular.';
    END IF;
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.vat_total IS DISTINCT FROM OLD.vat_total
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.number IS DISTINCT FROM OLD.number
       OR NEW.atcud IS DISTINCT FROM OLD.atcud
       OR NEW.provider_invoice_id IS DISTINCT FROM OLD.provider_invoice_id THEN
      RAISE EXCEPTION 'Campos fiscais de fatura certificada não podem ser alterados.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_immutability_guard ON public.invoices;
CREATE TRIGGER invoices_immutability_guard
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_immutability();
