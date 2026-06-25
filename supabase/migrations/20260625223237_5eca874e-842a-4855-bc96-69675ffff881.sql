
REVOKE SELECT ON public.carity_seller_profiles FROM authenticated;
GRANT SELECT (
  id, user_id, name, phone, location, verified, created_at, nif, address,
  document_type, document_number, document_url, selfie_url, kyc_status,
  kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason, suspended_at,
  suspension_reason, country_code, stripe_connect_onboarded,
  stripe_connect_charges_enabled, stripe_connect_payouts_enabled,
  account_type, dealer_company_name, dealer_nif, dealer_license,
  dealer_logo_url, dealer_slug, dealer_city, dealer_plan,
  dealer_active_until, dealer_description, dealer_subscription_status
) ON public.carity_seller_profiles TO authenticated;

REVOKE SELECT ON public.partners FROM authenticated, anon;
GRANT SELECT (
  id, name, type, contact_email, contact_phone, commission_percentage,
  discount_percentage, payout_method, status, created_at,
  payout_holder_name, payout_bank, auth_user_id, country_code
) ON public.partners TO authenticated;
GRANT SELECT (
  id, name, type, commission_percentage, discount_percentage, status, country_code
) ON public.partners TO anon;

REVOKE SELECT ON public.shops FROM authenticated;
GRANT SELECT (
  id, user_id, name, logo_url, email, phone, country, currency, vat_rate,
  labor_rate, language, created_at, timezone, status, nif, address, slug,
  primary_color, is_carity_partner, carity_priority, carity_active,
  carity_inspections_count, carity_approval_rate, carity_rating,
  latitude, longitude, country_code, stripe_connect_onboarded,
  stripe_connect_charges_enabled, stripe_connect_payouts_enabled,
  last_seen_at, health_score
) ON public.shops TO authenticated;

REVOKE SELECT ON public.subscriptions FROM authenticated, anon;
GRANT SELECT (
  id, shop_id, plan, billing_cycle, status, trial_end, current_period_end,
  created_at, updated_at, discount_percent, discount_reason,
  discount_applied_at, discount_applied_by, discount_expires_at, revenue_type
) ON public.subscriptions TO authenticated;

CREATE POLICY "Buyers view own confirmations by email"
ON public.sale_confirmations
FOR SELECT
TO authenticated
USING (
  confirmed_at IS NOT NULL
  AND buyer_email IS NOT NULL
  AND lower(buyer_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

ALTER FUNCTION public.crm_set_updated_at() SET search_path = public;
