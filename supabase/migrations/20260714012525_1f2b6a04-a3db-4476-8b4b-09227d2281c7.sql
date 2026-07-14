
-- =========================================================================
-- Phase A: Revoke EXECUTE from anon on SECURITY DEFINER functions that
-- should require an authenticated session. Public tokenized RPCs are kept.
-- Trigger functions have EXECUTE revoked from both anon and authenticated
-- (they are invoked implicitly by the trigger owner).
-- =========================================================================

DO $$
DECLARE
  fn text;
  args text;
  -- Functions that MUST remain callable by anon (public tokenized flows).
  keep_public text[] := ARRAY[
    'dealer_nif_available',
    'get_client_portal_data',
    'get_country_config',
    'get_inspection_verification_token',
    'get_public_shop_by_slug',
    'get_quote_by_token',
    'get_team_invitation_info',
    'market_vehicle_trust_check',
    'record_funnel_event',
    'respond_to_quote_by_token',
    'track_event',
    'update_landing_visit_engagement',
    'verify_inspection_certificate',
    'plan_has_feature'
  ];
  -- Trigger functions: revoke from both anon AND authenticated.
  triggers_only text[] := ARRAY[
    'enforce_invoice_immutability',
    'enforce_shop_country_immutability',
    'tg_auto_create_work_order_from_quote',
    'tg_closed_loop_on_event',
    'tg_notify_quote_approval',
    'create_shop_user_profile',
    'link_shop_to_crm_lead',
    'sync_shop_to_seller_profile',
    'touch_user_activity'
  ];
  -- Internal maintenance / cron-only functions: revoke from both.
  internal_only text[] := ARRAY[
    'archive_old_events',
    'purge_old_rate_limits',
    'compute_business_metrics_snapshot',
    'compute_customer_health',
    'recalculate_all_growth_opportunities',
    'refresh_email_campaign_metrics',
    'reconcile_entity_state',
    'retry_failed_jobs',
    'claim_next_actions',
    'complete_action',
    'assign_commercial_admin_for_known_email'
  ];
BEGIN
  FOR fn, args IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    IF fn = ANY(keep_public) THEN
      CONTINUE; -- leave public tokenized RPCs intact
    ELSIF fn = ANY(triggers_only) OR fn = ANY(internal_only) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn, args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', fn, args);
    ELSE
      -- Authenticated-only: revoke anon, keep authenticated + service_role.
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn, args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', fn, args);
    END IF;
  END LOOP;
END $$;
