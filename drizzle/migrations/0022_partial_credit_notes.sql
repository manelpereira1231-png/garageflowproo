CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'partial',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','issued','internal','error')),
  provider text,
  provider_id text,
  number text,
  atcud text,
  pdf_url text,
  permalink text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz
);
GRANT SELECT ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members read credit notes" ON public.credit_notes FOR SELECT TO authenticated
USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));
CREATE INDEX idx_credit_notes_invoice ON public.credit_notes(invoice_id);