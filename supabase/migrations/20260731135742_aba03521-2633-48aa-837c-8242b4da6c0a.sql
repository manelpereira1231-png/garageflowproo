CREATE TABLE public.manual_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  invoice_number text,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_percent numeric NOT NULL DEFAULT 3,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  stripe_session_id text,
  status text NOT NULL DEFAULT 'pending',
  transferred_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_payouts TO authenticated;
GRANT ALL ON public.manual_payouts TO service_role;

ALTER TABLE public.manual_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage manual payouts"
ON public.manual_payouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_manual_payouts_updated_at
BEFORE UPDATE ON public.manual_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_manual_payouts_shop ON public.manual_payouts(shop_id);
CREATE INDEX idx_manual_payouts_status ON public.manual_payouts(status);