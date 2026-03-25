-- Add auth_user_id column to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_partners_auth_user_id ON public.partners(auth_user_id);

-- RLS policy: affiliates can read their own partner record
CREATE POLICY "Affiliates read own partner"
ON public.partners
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- RLS policy: affiliates can update their own payout data
CREATE POLICY "Affiliates update own payout data"
ON public.partners
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Allow affiliates to read their own commissions
CREATE POLICY "Affiliates read own commissions"
ON public.partner_commissions
FOR SELECT
TO authenticated
USING (partner_id IN (SELECT id FROM public.partners WHERE auth_user_id = auth.uid()));

-- Allow affiliates to read their own payouts
CREATE POLICY "Affiliates read own payouts"
ON public.partner_payouts
FOR SELECT
TO authenticated
USING (partner_id IN (SELECT id FROM public.partners WHERE auth_user_id = auth.uid()));

-- Allow affiliates to read their own invites
CREATE POLICY "Affiliates read own invites"
ON public.partner_invites
FOR SELECT
TO authenticated
USING (partner_id IN (SELECT id FROM public.partners WHERE auth_user_id = auth.uid()));

-- Allow affiliates to read their own referrals
CREATE POLICY "Affiliates read own referrals"
ON public.partner_referrals
FOR SELECT
TO authenticated
USING (partner_id IN (SELECT id FROM public.partners WHERE auth_user_id = auth.uid()));

-- Allow affiliates to read own logs
CREATE POLICY "Affiliates read own logs"
ON public.partner_logs
FOR SELECT
TO authenticated
USING (partner_id IN (SELECT id FROM public.partners WHERE auth_user_id = auth.uid()));