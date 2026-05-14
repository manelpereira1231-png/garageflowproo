
-- 1) Make market-signatures bucket private (signatures should not be listable)
UPDATE storage.buckets SET public = false WHERE id = 'market-signatures';

-- Replace public read with authenticated-only read for signatures
DROP POLICY IF EXISTS "Public read signatures" ON storage.objects;
CREATE POLICY "Authenticated can read signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'market-signatures');

-- 2) Revoke EXECUTE from anon on internal/admin SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.cascade_delete_shop(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_shop_payout_paid(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_shop_payout(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.request_shop_payout(uuid, numeric, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_audit_status(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_risk_inspections(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_emails_for_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_shop_member_emails(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_seller_emails(uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.detect_workshop_anomalies() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calculate_inspection_risk(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalculate_trust_score(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_number(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_plan_limit(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dealer_can_publish(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_inspection_coherence(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_report_hash(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_admin_countries(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_regional_admin_for(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_is_shop_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_owns_shop(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_shop_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_trial_eligibility(text, text, text, text) FROM anon, public;

-- Grant EXECUTE to authenticated for the same set
GRANT EXECUTE ON FUNCTION public.cascade_delete_shop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_shop_payout_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_shop_payout(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_shop_payout(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_audit_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_risk_inspections(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails_for_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_member_emails(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_emails(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_workshop_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_inspection_risk(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_trust_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_plan_limit(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dealer_can_publish(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_inspection_coherence(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_report_hash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_countries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_regional_admin_for(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_shop_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_shop(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_shop_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trial_eligibility(text, text, text, text) TO authenticated;

-- Public-facing functions (intentionally callable by anon) — keep as-is and document
COMMENT ON FUNCTION public.verify_inspection_certificate(text) IS 'Public: verify certificate by token from public verification page';
COMMENT ON FUNCTION public.market_vehicle_trust_check(text, text, integer) IS 'Public: trust badge on Market listing';
COMMENT ON FUNCTION public.dealer_nif_available(text) IS 'Public: NIF availability check during dealer signup';
COMMENT ON FUNCTION public.get_country_config(text) IS 'Public: country config lookup for landing/pricing';
