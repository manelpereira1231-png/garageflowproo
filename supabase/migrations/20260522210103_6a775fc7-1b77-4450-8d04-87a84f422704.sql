
-- Expand landing_visits with internal traffic + engagement fields
ALTER TABLE public.landing_visits
  ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'real',
  ADD COLUMN IF NOT EXISTS scroll_depth int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_on_page int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_touch_source text DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_agent text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hostname text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_landing_visits_internal
  ON public.landing_visits (is_internal, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_visits_path
  ON public.landing_visits (landing_path, created_at DESC);

-- Allow anyone (anon, authenticated) to UPDATE their own session_id row
-- (used to update scroll_depth / time_on_page on beforeunload). Limited to
-- engagement fields only by column-level constraint via security definer RPC.
CREATE OR REPLACE FUNCTION public.update_landing_visit_engagement(
  _session_id text,
  _scroll int,
  _time int
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.landing_visits
     SET scroll_depth = GREATEST(scroll_depth, COALESCE(_scroll, 0)),
         time_on_page = GREATEST(time_on_page, COALESCE(_time, 0))
   WHERE session_id = _session_id
     AND created_at > now() - interval '6 hours';
$$;
GRANT EXECUTE ON FUNCTION public.update_landing_visit_engagement(text, int, int) TO anon, authenticated;

-- SEO conversions: ligar uma signup a uma visita
CREATE TABLE IF NOT EXISTS public.seo_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  user_id uuid,
  shop_id uuid,
  landing_path text DEFAULT '',
  first_touch_source text DEFAULT '',
  last_touch_source text DEFAULT '',
  utm_campaign text DEFAULT '',
  conversion_type text DEFAULT 'signup'
);
CREATE INDEX IF NOT EXISTS idx_seo_conversions_created_at
  ON public.seo_conversions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_conversions_path
  ON public.seo_conversions (landing_path);

ALTER TABLE public.seo_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log a conversion" ON public.seo_conversions;
CREATE POLICY "Anyone can log a conversion"
  ON public.seo_conversions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin reads conversions" ON public.seo_conversions;
CREATE POLICY "Super admin reads conversions"
  ON public.seo_conversions FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
