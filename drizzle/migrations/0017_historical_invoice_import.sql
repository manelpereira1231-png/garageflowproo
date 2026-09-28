ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS historical_import_id uuid,
  ADD COLUMN IF NOT EXISTS historical_meta jsonb,
  ADD COLUMN IF NOT EXISTS external_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_shop_external_ref_uidx
  ON public.invoices (shop_id, external_ref) WHERE external_ref IS NOT NULL;

CREATE TABLE public.historical_invoice_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shop_name text,
  admin_id uuid NOT NULL,
  admin_email text,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  found integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  pending integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  clients_matched integer NOT NULL DEFAULT 0,
  vehicles_matched integer NOT NULL DEFAULT 0,
  error_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.historical_invoice_imports TO authenticated;
GRANT ALL ON public.historical_invoice_imports TO service_role;
ALTER TABLE public.historical_invoice_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads imports" ON public.historical_invoice_imports
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE public.historical_invoice_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.historical_invoice_imports(id) ON DELETE SET NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  external_ref text NOT NULL,
  payload jsonb NOT NULL,
  reason text,
  resolved_invoice_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, external_ref)
);
GRANT SELECT ON public.historical_invoice_pending TO authenticated;
GRANT ALL ON public.historical_invoice_pending TO service_role;
ALTER TABLE public.historical_invoice_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads pending" ON public.historical_invoice_pending
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));