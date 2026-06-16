
-- 1) Set immutable search_path on remaining trigger functions
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- 2) Restrict overly permissive "service" ALL policies (USING true / WITH CHECK true) to service_role
DROP POLICY IF EXISTS anomaly_service_all ON public.anomaly_events;
CREATE POLICY anomaly_service_all ON public.anomaly_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS email_metrics_service_all ON public.email_campaign_metrics;
CREATE POLICY email_metrics_service_all ON public.email_campaign_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS entity_state_service_all ON public.entity_state;
CREATE POLICY entity_state_service_all ON public.entity_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS funnel_events_service_all ON public.funnel_events;
CREATE POLICY funnel_events_service_all ON public.funnel_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS seo_graph_service_all ON public.seo_graph_links;
CREATE POLICY seo_graph_service_all ON public.seo_graph_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Tighten service-only INSERTs to service_role
DROP POLICY IF EXISTS service_insert_api_logs ON public.api_logs;
CREATE POLICY service_insert_api_logs ON public.api_logs
  FOR INSERT TO service_role WITH CHECK (true);
