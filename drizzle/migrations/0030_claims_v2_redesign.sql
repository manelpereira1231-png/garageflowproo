ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'reparacao',
  ADD COLUMN IF NOT EXISTS has_daaa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_disassembly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replacement_vehicle text NOT NULL DEFAULT 'nao',
  ADD COLUMN IF NOT EXISTS replacement_start date,
  ADD COLUMN IF NOT EXISTS replacement_end date,
  ADD COLUMN IF NOT EXISTS storage_daily_rate numeric,
  ADD COLUMN IF NOT EXISTS disassembly_fee numeric,
  ADD COLUMN IF NOT EXISTS auto_notify_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase_override text,
  ADD COLUMN IF NOT EXISTS first_contact_at date,
  ADD COLUMN IF NOT EXISTS liability_assumed_at date,
  ADD COLUMN IF NOT EXISTS expert_report_at date,
  ADD COLUMN IF NOT EXISTS last_client_message text,
  ADD COLUMN IF NOT EXISTS last_client_message_at timestamptz;
ALTER TABLE public.claims ADD CONSTRAINT claims_outcome_chk CHECK (outcome IN ('reparacao','perda_total'));
ALTER TABLE public.claims ADD CONSTRAINT claims_replacement_chk CHECK (replacement_vehicle IN ('seguradora','oficina','nao'));
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_client_decision_chk;
ALTER TABLE public.claims ADD CONSTRAINT claims_client_decision_chk
  CHECK (client_decision IS NULL OR client_decision IN ('pending','keep_salvage','deliver_insurer','repair_own_cost','take_unrepaired'));
UPDATE public.claims SET outcome = 'perda_total' WHERE total_loss = true;

ALTER TABLE public.claim_supplements
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'adicional',
  ADD COLUMN IF NOT EXISTS number integer,
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_by text;
ALTER TABLE public.claim_supplements DROP CONSTRAINT IF EXISTS claim_supplements_status_chk;
ALTER TABLE public.claim_supplements ADD CONSTRAINT claim_supplements_status_chk CHECK (status IN ('pending','no_perito','approved','partial','rejected'));
ALTER TABLE public.claim_supplements ADD CONSTRAINT claim_supplements_type_chk CHECK (type IN ('inicial','adicional'));

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS storage_daily_rate numeric;

CREATE TABLE public.claim_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  audience text NOT NULL,
  supplement_id uuid REFERENCES public.claim_supplements(id) ON DELETE CASCADE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_share_links_audience_chk CHECK (audience IN ('cliente','perito'))
);
CREATE INDEX claim_share_links_claim_idx ON public.claim_share_links(claim_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_share_links TO authenticated;
GRANT ALL ON public.claim_share_links TO service_role;
ALTER TABLE public.claim_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage claim share links" ON public.claim_share_links
FOR ALL TO authenticated
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));