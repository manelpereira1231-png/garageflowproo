CREATE TABLE public.claim_supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  description text NOT NULL,
  amount_requested numeric NOT NULL DEFAULT 0,
  amount_approved numeric,
  status text NOT NULL DEFAULT 'pending',
  requested_at date NOT NULL DEFAULT CURRENT_DATE,
  decided_at date,
  notes text,
  billing_line_id uuid REFERENCES public.claim_billing_lines(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_supplements_status_chk CHECK (status IN ('pending','approved','partial','rejected'))
);
CREATE INDEX claim_supplements_claim_idx ON public.claim_supplements(claim_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_supplements TO authenticated;
GRANT ALL ON public.claim_supplements TO service_role;
ALTER TABLE public.claim_supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage claim supplements" ON public.claim_supplements
FOR ALL TO authenticated
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));