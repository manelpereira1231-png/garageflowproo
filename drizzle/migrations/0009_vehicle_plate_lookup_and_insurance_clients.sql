ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS tech_data jsonb, ADD COLUMN IF NOT EXISTS tech_source text, ADD COLUMN IF NOT EXISTS tech_updated_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_unique_shop_plate_norm ON public.vehicles (shop_id, upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))) WHERE deleted_at IS NULL;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_insurance boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS insurer_id uuid REFERENCES public.insurers(id) ON DELETE SET NULL;

CREATE TABLE public.vehicle_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  plate_norm text NOT NULL,
  provider text NOT NULL DEFAULT 'matricula_pt',
  source text NOT NULL DEFAULT 'api',
  status text NOT NULL,
  error_code text,
  duration_ms integer,
  cost numeric(10,4),
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicle_lookups TO authenticated;
GRANT ALL ON public.vehicle_lookups TO service_role;
ALTER TABLE public.vehicle_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicle_lookups_read ON public.vehicle_lookups FOR SELECT TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX vehicle_lookups_shop_created ON public.vehicle_lookups (shop_id, created_at DESC);
CREATE INDEX vehicle_lookups_plate_ok ON public.vehicle_lookups (plate_norm, created_at DESC) WHERE status = 'ok' AND source = 'api';

CREATE TABLE public.vehicle_lookup_limits (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  monthly_limit integer,
  blocked boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_lookup_limits TO authenticated;
GRANT ALL ON public.vehicle_lookup_limits TO service_role;
ALTER TABLE public.vehicle_lookup_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicle_lookup_limits_read ON public.vehicle_lookup_limits FOR SELECT TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE POLICY vehicle_lookup_limits_admin ON public.vehicle_lookup_limits FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));