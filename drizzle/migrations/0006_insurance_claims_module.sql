ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS process_type TEXT NOT NULL DEFAULT 'particular';

CREATE TABLE IF NOT EXISTS public.insurers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nif TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  claims_contact TEXT,
  claims_email TEXT,
  claims_phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurers TO authenticated;
GRANT ALL ON public.insurers TO service_role;
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
CREATE POLICY insurers_shop_all ON public.insurers FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_insurers_shop ON public.insurers(shop_id);

CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  insurer_id UUID REFERENCES public.insurers(id) ON DELETE SET NULL,
  claim_number TEXT,
  policy_number TEXT,
  process_number TEXT,
  report_number TEXT,
  claim_date DATE,
  report_date DATE,
  claim_type TEXT,
  description TEXT,
  location TEXT,
  liability TEXT,
  coverage TEXT,
  deductible NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  expert_status TEXT NOT NULL DEFAULT 'not_scheduled',
  expert_date DATE,
  expert_time TEXT,
  expert_location TEXT,
  expert_name TEXT,
  expert_company TEXT,
  expert_contact TEXT,
  expert_report_number TEXT,
  expert_done_date DATE,
  expert_result TEXT,
  expert_notes TEXT,
  amount_requested NUMERIC(12,2),
  amount_approved NUMERIC(12,2),
  amount_rejected NUMERIC(12,2),
  approval_status TEXT NOT NULL DEFAULT 'waiting',
  approval_date DATE,
  approved_by TEXT,
  approval_reference TEXT,
  approval_notes TEXT,
  insurer_quote_notes TEXT,
  next_action TEXT,
  next_action_date DATE,
  next_action_owner TEXT,
  external_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY claims_shop_all ON public.claims FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_claims_shop ON public.claims(shop_id);
CREATE INDEX IF NOT EXISTS idx_claims_vehicle ON public.claims(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_claims_client ON public.claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_wo ON public.claims(work_order_id);

CREATE TABLE IF NOT EXISTS public.claim_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'insurer',
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_contacts TO authenticated;
GRANT ALL ON public.claim_contacts TO service_role;
ALTER TABLE public.claim_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_contacts_shop_all ON public.claim_contacts FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_claim_contacts_claim ON public.claim_contacts(claim_id);

CREATE TABLE IF NOT EXISTS public.claim_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  direction TEXT NOT NULL DEFAULT 'out',
  status TEXT NOT NULL DEFAULT 'logged',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  user_name TEXT,
  contact_id UUID REFERENCES public.claim_contacts(id) ON DELETE SET NULL,
  contact_label TEXT,
  subject TEXT,
  body TEXT,
  duration_minutes INTEGER,
  outcome TEXT,
  next_step TEXT,
  next_contact_date DATE,
  portal_name TEXT,
  portal_url TEXT,
  portal_reference TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_communications TO authenticated;
GRANT ALL ON public.claim_communications TO service_role;
ALTER TABLE public.claim_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_comms_shop_all ON public.claim_communications FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_claim_comms_claim ON public.claim_communications(claim_id);

CREATE TABLE IF NOT EXISTS public.claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_documents TO authenticated;
GRANT ALL ON public.claim_documents TO service_role;
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_docs_shop_all ON public.claim_documents FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_claim_docs_claim ON public.claim_documents(claim_id);

CREATE TABLE IF NOT EXISTS public.claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  description TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_events TO authenticated;
GRANT ALL ON public.claim_events TO service_role;
ALTER TABLE public.claim_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_events_shop_all ON public.claim_events FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON public.claim_events(claim_id);

CREATE OR REPLACE FUNCTION public.tg_claim_track()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.claim_events (shop_id, claim_id, kind, description, created_by)
    VALUES (NEW.shop_id, NEW.id, 'created', 'Sinistro criado', NEW.created_by);
  ELSE
    NEW.updated_at := now();
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, meta)
      VALUES (NEW.shop_id, NEW.id, 'status', 'Estado alterado para ' || NEW.status,
              jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.expert_status IS DISTINCT FROM OLD.expert_status THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, meta)
      VALUES (NEW.shop_id, NEW.id, 'expert', 'Peritagem: ' || NEW.expert_status,
              jsonb_build_object('from', OLD.expert_status, 'to', NEW.expert_status));
    END IF;
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, meta)
      VALUES (NEW.shop_id, NEW.id, 'approval', 'Aprovação: ' || NEW.approval_status,
              jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status));
    END IF;
  END IF;

  IF NEW.next_action_date IS NOT NULL
     AND NEW.status NOT IN ('done', 'cancelled')
     AND (TG_OP = 'INSERT' OR NEW.next_action_date IS DISTINCT FROM OLD.next_action_date
          OR NEW.next_action IS DISTINCT FROM OLD.next_action) THEN
    DELETE FROM public.alerts
      WHERE shop_id = NEW.shop_id AND type = 'claim_follow_up'
        AND message LIKE '%' || NEW.id::text || '%' AND status <> 'resolved';
    INSERT INTO public.alerts (shop_id, vehicle_id, client_id, type, title, message, due_date, status, priority)
    VALUES (NEW.shop_id, NEW.vehicle_id, NEW.client_id, 'claim_follow_up',
            'Sinistro: próxima ação',
            COALESCE(NEW.next_action, 'Acompanhar processo de seguradora') || ' [' || NEW.id::text || ']',
            NEW.next_action_date, 'pending', 'medium');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim_track_ins ON public.claims;
CREATE TRIGGER trg_claim_track_ins AFTER INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.tg_claim_track();
DROP TRIGGER IF EXISTS trg_claim_track_upd ON public.claims;
CREATE TRIGGER trg_claim_track_upd BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.tg_claim_track();