
-- 1. Fix mutable search_path on trigger functions
ALTER FUNCTION public.tg_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_demo_requests_autoarchive() SET search_path = public;

-- 2. Fix SECURITY DEFINER view (make it invoker)
ALTER VIEW public.carity_inspection_reports_public SET (security_invoker = true);

-- 3. Stop broadcasting country_settings (contains stripe_* IDs) via Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.country_settings;

-- 4. Restrict platform_settings SELECT to authenticated users only
DROP POLICY IF EXISTS "Public read of platform_settings" ON public.platform_settings;
CREATE POLICY "Authenticated read platform_settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);
