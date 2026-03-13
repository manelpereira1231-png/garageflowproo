
-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'supplier',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  commission_percentage numeric NOT NULL DEFAULT 0,
  discount_percentage numeric NOT NULL DEFAULT 0,
  api_key text UNIQUE,
  payout_method text NOT NULL DEFAULT 'bank_transfer',
  stripe_account_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage partners" ON public.partners
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Partner invites
CREATE TABLE public.partner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  workshop_email text NOT NULL,
  workshop_name text NOT NULL DEFAULT '',
  workshop_phone text NOT NULL DEFAULT '',
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_offer text NOT NULL DEFAULT 'pro',
  discount_percent numeric NOT NULL DEFAULT 0,
  trial_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  accepted_at timestamptz,
  shop_id uuid REFERENCES public.shops(id),
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage partner_invites" ON public.partner_invites
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Public read partner invite by token" ON public.partner_invites
  FOR SELECT TO anon
  USING (invite_token IS NOT NULL);

-- Partner referrals
CREATE TABLE public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id),
  commission_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage partner_referrals" ON public.partner_referrals
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Partner commissions
CREATE TABLE public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  referral_id uuid REFERENCES public.partner_referrals(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending',
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage partner_commissions" ON public.partner_commissions
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Partner payouts
CREATE TABLE public.partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage partner_payouts" ON public.partner_payouts
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Partner logs (audit)
CREATE TABLE public.partner_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage partner_logs" ON public.partner_logs
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Parts orders (for supplier parts ordering from work orders)
CREATE TABLE public.parts_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  work_order_id uuid REFERENCES public.work_orders(id),
  part_name text NOT NULL,
  part_reference text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE public.parts_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members manage parts_orders" ON public.parts_orders
  FOR ALL TO public
  USING ((shop_id IN (SELECT get_user_shop_ids(auth.uid()))) OR is_super_admin(auth.uid()))
  WITH CHECK ((shop_id IN (SELECT get_user_shop_ids(auth.uid()))) OR is_super_admin(auth.uid()));
