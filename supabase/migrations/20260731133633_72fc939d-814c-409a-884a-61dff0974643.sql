INSERT INTO public.platform_settings (key, value)
VALUES ('invoice_payments', jsonb_build_object('platform_fee_percent', 3))
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated read safe platform_settings" ON public.platform_settings;
CREATE POLICY "Authenticated read safe platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (key = ANY (ARRAY['landing','pricing','plan_limits','feature_gates','pdf','notifications','invoice_payments']));