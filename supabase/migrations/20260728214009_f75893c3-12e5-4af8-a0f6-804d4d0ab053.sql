-- =========================================================================
-- BLOCO 1 FASE 2 — Hardening SECURITY DEFINER function EXECUTE privileges
-- =========================================================================
-- Decisões documentadas no comentário do migration. Objetivo: eliminar
-- superfície anónima em funções que não precisam mesmo dela.

-- Trigger-only functions (nunca chamadas por API) → revogar de anon+authenticated
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'block_dealer_self_inspection()',
    'block_dealer_self_offer()',
    'enforce_primary_shop_undeletable()',
    'enforce_shop_creation_limit()',
    'ensure_shop_owner_membership()',
    'gsn_apply_stock_movement()',
    'gsn_prevent_supplier_self_privilege()',
    'gsn_reviews_guard_supplier_update()',
    'mirror_country_settings_to_prices()',
    'prevent_partner_sensitive_self_update()',
    'set_default_group_owner()',
    'assign_commercial_admin_for_known_email()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- Admin/internal functions → só service_role
DO $$
DECLARE fn text; fns text[] := ARRAY[
  'archive_old_events(integer)',
  'delete_email(text, bigint)',
  'email_queue_dispatch()',
  'email_queue_wake()',
  'enqueue_email(text, jsonb)',
  'read_email_batch(text, integer, integer)',
  'move_to_dlq(text, text, bigint, jsonb)',
  'get_ai_admin_stats()',
  'get_ai_global_status()',
  'admin_get_promotion(text, text, text)',
  'admin_list_plan_country_prices()'
];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- Admin-authenticated (super_admin check inside): restringir a authenticated
DO $$
DECLARE fn text; fns text[] := ARRAY[
  'delete_child_shop(uuid)',
  'transfer_shop_user(uuid, uuid, uuid)'
];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, PUBLIC', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- Funções internas / de utilizador autenticado → remover anon
DO $$
DECLARE fn text; fns text[] := ARRAY[
  '_ai_check_rate_limit(text, uuid, integer)',
  '_ai_setting_numeric(text, numeric)',
  'ai_log_cache_hit(uuid, text, text)',
  'ai_save_cache(text, uuid, text, jsonb, integer)',
  'ai_try_cache(text)',
  'consume_ai_credit(uuid, text, integer, jsonb)',
  'consume_platform_ai_credit(text, integer, jsonb)',
  'get_ai_usage(uuid)',
  'get_user_shop_ids(uuid)',
  'get_shop_creation_status(uuid)',
  'get_my_supplier_id()',
  'is_super_admin(uuid)',
  'is_group_owner(uuid)',
  'get_inspection_verification_token(uuid)',
  'gsn_cart_add(uuid, uuid, integer)',
  'gsn_cart_checkout(uuid)',
  'gsn_cart_ensure(uuid)',
  'gsn_complaint_create(uuid, text, text)',
  'gsn_order_transition(uuid, text, text)',
  'gsn_current_supplier_state()',
  'gsn_supplier_is_approved(uuid)',
  'gsn_approve_application(uuid, uuid, numeric)',
  'gsn_reject_application(uuid, text)'
];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, PUBLIC', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- Funções que DEVEM ficar publicamente executáveis (documentado):
--   respond_to_quote_by_token, get_quote_by_token, get_client_portal_data,
--   verify_inspection_certificate, get_public_shop_by_slug, gsn_accept_invite,
--   get_team_invitation_info, get_country_config, get_default_plan_slug,
--   get_effective_plan_price, get_active_promotion, plan_has_feature,
--   track_event, record_funnel_event, update_landing_visit_engagement,
--   market_vehicle_trust_check, dealer_nif_available, gsn_search_products
-- → mantidas com EXECUTE para anon (fluxos públicos legítimos).

-- Nota sobre policies USING(true):
-- As policies "true" que restam são INSERT-only em tabelas de formulários
-- públicos (appointments, demo_requests, support_tickets, event_logs,
-- landing_visits, seo_conversions, pilot_leads, listing_views, email_events)
-- e ALL em tabelas internas restritas a service_role (anomaly_events,
-- email_campaign_metrics, entity_state, funnel_events, seo_graph_links).
-- service_role bypassa RLS por design; policies "true" nesse escopo são
-- inertes/defensivas. As INSERT públicas são intencionais para submissões
-- anónimas — os campos sensíveis são restringidos por SELECT policies
-- separadas e por triggers de validação. Sem alterações necessárias.