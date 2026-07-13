
-- 1. Add service_id + assigned_to to appointments (nullable, backwards compatible)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON public.appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_date ON public.appointments(shop_id, date);

-- 2. Add opening_hours to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '{
    "mon":{"open":"09:00","close":"18:00","break":["13:00","14:00"]},
    "tue":{"open":"09:00","close":"18:00","break":["13:00","14:00"]},
    "wed":{"open":"09:00","close":"18:00","break":["13:00","14:00"]},
    "thu":{"open":"09:00","close":"18:00","break":["13:00","14:00"]},
    "fri":{"open":"09:00","close":"18:00","break":["13:00","14:00"]},
    "sat":{"open":null,"close":null,"break":null},
    "sun":{"open":null,"close":null,"break":null}
  }'::jsonb;

-- 3. Staff absences table
CREATE TABLE IF NOT EXISTS public.staff_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_absences TO authenticated;
GRANT ALL ON public.staff_absences TO service_role;

ALTER TABLE public.staff_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_absences_shop_access"
  ON public.staff_absences
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
    OR shop_id IN (SELECT shop_id FROM public.shop_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
    OR shop_id IN (SELECT shop_id FROM public.shop_users WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_staff_absences_shop_user ON public.staff_absences(shop_id, user_id, start_at, end_at);
