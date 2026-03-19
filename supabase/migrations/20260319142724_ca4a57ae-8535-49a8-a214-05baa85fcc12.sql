
-- Referral system tables
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  free_months_balance integer NOT NULL DEFAULT 0,
  paid_referrals_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_empty_code CHECK (code != '')
);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid UNIQUE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','trial','paid','rejected')),
  plan text DEFAULT 'Free',
  payment_confirmed boolean NOT NULL DEFAULT false,
  reward_given boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  months_earned integer NOT NULL DEFAULT 1,
  reward_type text NOT NULL DEFAULT 'monthly' CHECK (reward_type IN ('monthly','bonus')),
  source_referral_id uuid REFERENCES public.referrals(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can read/manage their own referral code
CREATE POLICY "Users manage own referral_codes" ON public.referral_codes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin can manage all
CREATE POLICY "Super admin manage referral_codes" ON public.referral_codes
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Users can see referrals where they are referrer
CREATE POLICY "Users view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- System can insert referrals
CREATE POLICY "Authenticated insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Super admin manage all referrals
CREATE POLICY "Super admin manage referrals" ON public.referrals
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Users view own rewards
CREATE POLICY "Users view own rewards" ON public.referral_rewards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Super admin manage rewards
CREATE POLICY "Super admin manage rewards" ON public.referral_rewards
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_referral_codes_user ON public.referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);
