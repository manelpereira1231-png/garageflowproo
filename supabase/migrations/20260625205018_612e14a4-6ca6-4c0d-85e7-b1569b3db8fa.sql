
-- Helper: is_commercial_admin
CREATE OR REPLACE FUNCTION public.is_commercial_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('commercial_admin','super_admin','admin')
  );
$$;

-- ============ CRM LEADS ============
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  name text NOT NULL,
  owner_name text,
  email text,
  phone text,
  district text,
  country text,
  source text,
  target_plan text,
  estimated_value numeric(10,2),
  pipeline_stage text NOT NULL DEFAULT 'lead',
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'medium',
  next_contact_at timestamptz,
  last_contact_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commercial admins manage leads"
  ON public.crm_leads FOR ALL
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON public.crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_next_contact ON public.crm_leads(next_contact_at);

-- ============ CRM MEETINGS ============
CREATE TABLE IF NOT EXISTS public.crm_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  title text NOT NULL,
  meeting_type text NOT NULL DEFAULT 'meeting', -- meeting | demo | follow_up | call
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  location text,
  meeting_url text,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | done | cancelled | no_show
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_meetings TO authenticated;
GRANT ALL ON public.crm_meetings TO service_role;
ALTER TABLE public.crm_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commercial admins manage meetings"
  ON public.crm_meetings FOR ALL
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());

CREATE INDEX IF NOT EXISTS idx_crm_meetings_scheduled ON public.crm_meetings(scheduled_at);

-- ============ CRM TASKS ============
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open', -- open | done | cancelled
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commercial admins manage tasks"
  ON public.crm_tasks FOR ALL
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());

CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks(due_at);

-- ============ CRM NOTES ============
CREATE TABLE IF NOT EXISTS public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_notes TO authenticated;
GRANT ALL ON public.crm_notes TO service_role;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commercial admins manage notes"
  ON public.crm_notes FOR ALL
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());

-- ============ CRM OBJECTIVES ============
CREATE TABLE IF NOT EXISTS public.crm_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  metric text NOT NULL, -- new_shops | revenue | conversions | retention
  target_value numeric(12,2) NOT NULL,
  period text NOT NULL, -- month | quarter | year
  period_start date NOT NULL,
  period_end date NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_objectives TO authenticated;
GRANT ALL ON public.crm_objectives TO service_role;
ALTER TABLE public.crm_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commercial admins manage objectives"
  ON public.crm_objectives FOR ALL
  USING (public.is_commercial_admin())
  WITH CHECK (public.is_commercial_admin());

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.crm_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_meetings_updated_at ON public.crm_meetings;
CREATE TRIGGER trg_crm_meetings_updated_at BEFORE UPDATE ON public.crm_meetings
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER trg_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_objectives_updated_at ON public.crm_objectives;
CREATE TRIGGER trg_crm_objectives_updated_at BEFORE UPDATE ON public.crm_objectives
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

-- ============ AUTO-ASSIGN commercial_admin to contact@garageflow.pt ============
CREATE OR REPLACE FUNCTION public.assign_commercial_admin_for_known_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND lower(NEW.email) = 'contact@garageflow.pt' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'commercial_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_commercial_admin ON auth.users;
CREATE TRIGGER trg_assign_commercial_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_commercial_admin_for_known_email();

-- Apply immediately if account already exists
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'commercial_admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'contact@garageflow.pt'
ON CONFLICT DO NOTHING;
