ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_claim_id ON public.invoices(claim_id);
UPDATE public.invoices i SET claim_id = c.id FROM public.claims c WHERE c.invoice_id = i.id AND i.claim_id IS NULL;