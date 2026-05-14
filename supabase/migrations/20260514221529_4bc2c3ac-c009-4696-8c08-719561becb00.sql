
-- Revoke EXECUTE from anon/public on remaining internal/trigger SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.block_dealer_self_inspection() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.block_dealer_self_offer() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_duplicate_vin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_shop_creation_limit(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.credit_shop_wallet_on_inspection_complete() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.flag_suspicious_transactions() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_shop_slug() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_shop_subscription() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_vehicle_trust_from_inspection() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_vehicle_trust_from_work_order() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_dealer_listing() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.normalize_and_check_dealer_nif() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalculate_workshop_trust(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.seed_email_templates_for_shop(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_inspection_verification_token() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.suspend_user_on_chat_evasion() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_seed_email_templates() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_inspection_report_risk() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_stock_from_parts_order() FROM anon, public;

-- Grant back to authenticated only for the non-trigger callable ones
GRANT EXECUTE ON FUNCTION public.check_shop_creation_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_workshop_trust(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_email_templates_for_shop(uuid) TO authenticated;
