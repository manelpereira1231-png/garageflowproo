
-- Plans metadata (editable in admin). Prices live in country_settings per country×cycle.
CREATE TABLE IF NOT EXISTS public.plans (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_public_read"
  ON public.plans FOR SELECT
  USING (true);

CREATE POLICY "plans_admin_write"
  ON public.plans FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS plans_touch_updated_at ON public.plans;
CREATE TRIGGER plans_touch_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_plans_updated_at();

-- Seed defaults (idempotent)
INSERT INTO public.plans (slug, name, description, sort_order) VALUES
  ('free',   'Entrada', 'Plano de entrada — ideal para começar', 1),
  ('pro',    'Pro',     'Para oficinas em crescimento',           2),
  ('garage', 'Garage',  'Operação completa multi-oficina',        3)
ON CONFLICT (slug) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
