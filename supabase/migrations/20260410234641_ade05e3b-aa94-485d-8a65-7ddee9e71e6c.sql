
CREATE TABLE public.landing_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  source text DEFAULT '',
  medium text DEFAULT '',
  campaign text DEFAULT '',
  gclid text DEFAULT '',
  landing_path text DEFAULT '/',
  referrer text DEFAULT '',
  device_type text DEFAULT 'desktop',
  country_hint text DEFAULT '',
  session_id text DEFAULT ''
);

ALTER TABLE public.landing_visits ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous) can insert a visit record
CREATE POLICY "Anyone can log a visit"
ON public.landing_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only super admin can read visit data
CREATE POLICY "Super admin reads visits"
ON public.landing_visits
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Create index for time-based queries
CREATE INDEX idx_landing_visits_created_at ON public.landing_visits (created_at DESC);
CREATE INDEX idx_landing_visits_gclid ON public.landing_visits (gclid) WHERE gclid != '';
