
-- Extend crm_leads with contact fields needed by import + shop linkage
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS shop_link_id uuid REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_leads_email_idx ON public.crm_leads (lower(email));
CREATE INDEX IF NOT EXISTS crm_leads_phone_idx ON public.crm_leads (phone);
CREATE INDEX IF NOT EXISTS crm_leads_shop_link_idx ON public.crm_leads (shop_link_id);

-- Call log
CREATE TABLE IF NOT EXISTS public.crm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  shop_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('answered','no_answer','invalid_number','callback','meeting_scheduled')),
  duration_seconds integer,
  notes text,
  called_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_calls TO authenticated;
GRANT ALL ON public.crm_calls TO service_role;
ALTER TABLE public.crm_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commercial admins manage calls" ON public.crm_calls
  FOR ALL TO authenticated
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());
CREATE INDEX IF NOT EXISTS crm_calls_lead_idx ON public.crm_calls (lead_id, called_at DESC);

-- Unified activity/history log
CREATE TABLE IF NOT EXISTS public.crm_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  shop_id uuid,
  kind text NOT NULL,
  summary text,
  meta jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activity TO authenticated;
GRANT ALL ON public.crm_activity TO service_role;
ALTER TABLE public.crm_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commercial admins manage activity" ON public.crm_activity
  FOR ALL TO authenticated
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());
CREATE INDEX IF NOT EXISTS crm_activity_lead_idx ON public.crm_activity (lead_id, created_at DESC);
