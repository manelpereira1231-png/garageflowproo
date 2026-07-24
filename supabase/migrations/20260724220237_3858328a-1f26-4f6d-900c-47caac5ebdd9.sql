
-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.gsn_supplier_state AS ENUM ('invited','pending','pending_approval','approved','rejected','suspended','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Colunas novas em gsn_suppliers
ALTER TABLE public.gsn_suppliers
  ADD COLUMN IF NOT EXISTS state public.gsn_supplier_state NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS application_source text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS docs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS gsn_suppliers_state_idx ON public.gsn_suppliers(state) WHERE deleted_at IS NULL;

-- 3) Tabela gsn_supplier_invites
CREATE TABLE IF NOT EXISTS public.gsn_supplier_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  company_name text NOT NULL,
  trade_name text,
  vat_number text,
  phone text,
  website text,
  country text DEFAULT 'PT',
  district text,
  city text,
  plan text,
  commission_percentage numeric(5,2) DEFAULT 5,
  notes text,
  invited_by uuid,
  used_at timestamptz,
  used_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_supplier_invites TO authenticated;
GRANT ALL ON public.gsn_supplier_invites TO service_role;
ALTER TABLE public.gsn_supplier_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsn_invites_admin_all ON public.gsn_supplier_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4) Tabela gsn_supplier_applications
CREATE TABLE IF NOT EXISTS public.gsn_supplier_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  trade_name text,
  responsible_name text NOT NULL,
  email text NOT NULL,
  phone text,
  vat_number text,
  website text,
  address text,
  city text,
  district text,
  postal_code text,
  country text DEFAULT 'PT',
  description text,
  categories text[] DEFAULT '{}',
  brands text[] DEFAULT '{}',
  carriers text[] DEFAULT '{}',
  average_delivery_time text,
  accepted_terms boolean NOT NULL DEFAULT false,
  state public.gsn_supplier_state NOT NULL DEFAULT 'pending',
  rejection_reason text,
  admin_notes text,
  created_supplier_id uuid REFERENCES public.gsn_suppliers(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  source text DEFAULT 'public',
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gsn_supplier_applications TO anon;  -- só usada por policy admin; anon bloqueado
REVOKE SELECT ON public.gsn_supplier_applications FROM anon;
GRANT INSERT ON public.gsn_supplier_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.gsn_supplier_applications TO authenticated;
GRANT ALL ON public.gsn_supplier_applications TO service_role;
ALTER TABLE public.gsn_supplier_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsn_apps_public_insert ON public.gsn_supplier_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (accepted_terms = true AND length(company_name) BETWEEN 2 AND 200 AND length(email) BETWEEN 5 AND 200);

CREATE POLICY gsn_apps_admin_read ON public.gsn_supplier_applications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY gsn_apps_admin_update ON public.gsn_supplier_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY gsn_apps_admin_delete ON public.gsn_supplier_applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 5) Trigger updated_at
CREATE OR REPLACE FUNCTION public.gsn_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_gsn_invites_touch ON public.gsn_supplier_invites;
CREATE TRIGGER trg_gsn_invites_touch BEFORE UPDATE ON public.gsn_supplier_invites
  FOR EACH ROW EXECUTE FUNCTION public.gsn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_gsn_apps_touch ON public.gsn_supplier_applications;
CREATE TRIGGER trg_gsn_apps_touch BEFORE UPDATE ON public.gsn_supplier_applications
  FOR EACH ROW EXECUTE FUNCTION public.gsn_touch_updated_at();

-- 6) Bloquear supplier de mudar campos sensíveis do próprio registo
CREATE OR REPLACE FUNCTION public.gsn_prevent_supplier_self_privilege()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin') THEN RETURN NEW; END IF;
  IF NEW.state IS DISTINCT FROM OLD.state
     OR NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.suspended IS DISTINCT FROM OLD.suspended
     OR NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'not allowed to modify privileged fields';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gsn_supplier_privilege ON public.gsn_suppliers;
CREATE TRIGGER trg_gsn_supplier_privilege BEFORE UPDATE ON public.gsn_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.gsn_prevent_supplier_self_privilege();

-- 7) Funções de suporte
CREATE OR REPLACE FUNCTION public.gsn_supplier_is_approved(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gsn_suppliers
    WHERE owner_user_id = _uid AND state = 'approved' AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.gsn_current_supplier_state()
RETURNS TABLE(supplier_id uuid, state public.gsn_supplier_state, rejection_reason text, company_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, state, rejection_reason, company_name
  FROM public.gsn_suppliers
  WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
  ORDER BY created_at ASC LIMIT 1;
$$;

-- 8) Aceitar convite: cria/atualiza supplier ligado ao user autenticado
CREATE OR REPLACE FUNCTION public.gsn_accept_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_inv public.gsn_supplier_invites%ROWTYPE; v_sup_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_inv FROM public.gsn_supplier_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF v_inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'token already used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'token expired'; END IF;

  INSERT INTO public.gsn_suppliers (
    owner_user_id, company_name, trade_name, vat_number, email, phone, website,
    country, district, city, commission_percentage, subscription_plan,
    state, application_source, approved, active, invited_at, invited_by
  ) VALUES (
    v_uid, v_inv.company_name, v_inv.trade_name, v_inv.vat_number, v_inv.email, v_inv.phone, v_inv.website,
    COALESCE(v_inv.country,'PT'), v_inv.district, v_inv.city, COALESCE(v_inv.commission_percentage,5), v_inv.plan,
    'pending_approval', 'invite', false, true, v_inv.created_at, v_inv.invited_by
  ) RETURNING id INTO v_sup_id;

  UPDATE public.gsn_supplier_invites SET used_at = now(), used_by = v_uid WHERE id = v_inv.id;
  RETURN v_sup_id;
END $$;

REVOKE ALL ON FUNCTION public.gsn_accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsn_accept_invite(text) TO authenticated;

-- 9) Aprovar candidatura pública (só super admin)
CREATE OR REPLACE FUNCTION public.gsn_approve_application(_app_id uuid, _owner_user_id uuid, _commission numeric DEFAULT 5)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_app public.gsn_supplier_applications%ROWTYPE; v_sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_app FROM public.gsn_supplier_applications WHERE id=_app_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application not found'; END IF;

  INSERT INTO public.gsn_suppliers (
    owner_user_id, company_name, trade_name, vat_number, email, phone, website,
    country, district, city, postal_code, address, description, average_delivery_time,
    commission_percentage, state, application_source, approved, active, approved_at, approved_by
  ) VALUES (
    _owner_user_id, v_app.company_name, v_app.trade_name, v_app.vat_number, v_app.email, v_app.phone, v_app.website,
    COALESCE(v_app.country,'PT'), v_app.district, v_app.city, v_app.postal_code, v_app.address, v_app.description, v_app.average_delivery_time,
    COALESCE(_commission,5), 'approved', COALESCE(v_app.source,'public'), true, true, now(), auth.uid()
  ) RETURNING id INTO v_sid;

  UPDATE public.gsn_supplier_applications
    SET state='approved', reviewed_by=auth.uid(), reviewed_at=now(), created_supplier_id=v_sid
    WHERE id=_app_id;
  RETURN v_sid;
END $$;

REVOKE ALL ON FUNCTION public.gsn_approve_application(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsn_approve_application(uuid, uuid, numeric) TO authenticated;

-- 10) Rejeitar candidatura
CREATE OR REPLACE FUNCTION public.gsn_reject_application(_app_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.gsn_supplier_applications
    SET state='rejected', rejection_reason=_reason, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_app_id;
END $$;

REVOKE ALL ON FUNCTION public.gsn_reject_application(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsn_reject_application(uuid, text) TO authenticated;
