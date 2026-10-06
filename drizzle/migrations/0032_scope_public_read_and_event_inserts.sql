DROP POLICY IF EXISTS "everyone read whitelist" ON public.action_whitelist;
CREATE POLICY "everyone read whitelist" ON public.action_whitelist FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "funnel_events_insert_auth" ON public.funnel_events;
CREATE POLICY "funnel_events_insert_auth" ON public.funnel_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "anyone_insert_email_events" ON public.email_events;
CREATE POLICY "anyone_insert_email_events" ON public.email_events FOR INSERT TO service_role WITH CHECK (event_type IS NOT NULL);

DROP POLICY IF EXISTS "anyone_insert_events" ON public.event_logs;
CREATE POLICY "anyone_insert_events" ON public.event_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Public read feature flags" ON public.system_feature_flags;
CREATE POLICY "Public read feature flags" ON public.system_feature_flags FOR SELECT TO anon, authenticated
USING (key IN ('market_enabled','erp_enabled','public_signup_erp','public_signup_market') OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "system_features_read" ON public.system_features;
CREATE POLICY "system_features_read" ON public.system_features FOR SELECT TO anon, authenticated
USING (key IN ('supplier_network_enabled'));

DROP POLICY IF EXISTS "gsn_categories_read" ON public.gsn_categories;
CREATE POLICY "gsn_categories_read" ON public.gsn_categories FOR SELECT TO anon, authenticated USING (active = true);