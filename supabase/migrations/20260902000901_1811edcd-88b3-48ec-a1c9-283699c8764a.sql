GRANT SELECT (id, name, type, api_key, payout_method, payout_holder_name, payout_iban, payout_mbway_phone, payout_bank, status, created_at, auth_user_id, country_code) ON public.partners TO authenticated;
GRANT UPDATE (payout_method, payout_holder_name, payout_iban, payout_mbway_phone, payout_bank) ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

GRANT SELECT ON public.partner_invites TO authenticated;
GRANT ALL ON public.partner_invites TO service_role;

GRANT SELECT ON public.partner_commissions TO authenticated;
GRANT ALL ON public.partner_commissions TO service_role;

GRANT SELECT ON public.partner_payouts TO authenticated;
GRANT ALL ON public.partner_payouts TO service_role;

GRANT SELECT ON public.partner_logs TO authenticated;
GRANT ALL ON public.partner_logs TO service_role;