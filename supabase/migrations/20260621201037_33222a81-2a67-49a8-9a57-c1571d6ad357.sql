-- Allow all authenticated users (and anon for the landing page) to READ
-- platform_settings so the app can apply admin-managed plan limits and
-- feature gates everywhere — not only inside the admin panel.
-- Writes remain restricted to super admins via the existing policy.

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

DROP POLICY IF EXISTS "Public read of platform_settings" ON public.platform_settings;
CREATE POLICY "Public read of platform_settings"
  ON public.platform_settings
  FOR SELECT
  USING (true);