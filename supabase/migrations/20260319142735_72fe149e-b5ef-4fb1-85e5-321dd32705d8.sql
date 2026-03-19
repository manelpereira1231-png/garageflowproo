
-- Fix overly permissive INSERT policy on referrals
DROP POLICY IF EXISTS "Authenticated insert referrals" ON public.referrals;
CREATE POLICY "Users insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = auth.uid());
