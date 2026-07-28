
-- 1) Fix SECURITY DEFINER views (ERROR level)
ALTER VIEW public.carity_seller_profiles_public SET (security_invoker = true);
ALTER VIEW public.plan_country_prices_public SET (security_invoker = true);

-- 2) Tables with RLS enabled but no policy: lock down (only service_role via bypass)
-- ai_rate_limits: internal rate-limit ledger, no client access
REVOKE ALL ON public.ai_rate_limits FROM anon, authenticated;
GRANT ALL ON public.ai_rate_limits TO service_role;
CREATE POLICY "ai_rate_limits_no_client_access"
  ON public.ai_rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ai_response_cache: internal cache, no client access
REVOKE ALL ON public.ai_response_cache FROM anon, authenticated;
GRANT ALL ON public.ai_response_cache TO service_role;
CREATE POLICY "ai_response_cache_no_client_access"
  ON public.ai_response_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
