
-- Automation rules table
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'quote_approved',
  conditions jsonb NOT NULL DEFAULT '{}',
  action_type text NOT NULL DEFAULT 'send_email',
  action_config jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage automation_rules" ON public.automation_rules FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Automation logs table
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members view automation_logs" ON public.automation_logs FOR SELECT
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));
CREATE POLICY "System insert automation_logs" ON public.automation_logs FOR INSERT
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- API keys table
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{read}',
  rate_limit integer NOT NULL DEFAULT 60,
  last_used_at timestamptz,
  request_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owners manage api_keys" ON public.api_keys FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Loyalty rewards catalog
CREATE TABLE public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  points_cost integer NOT NULL DEFAULT 100,
  reward_type text NOT NULL DEFAULT 'discount',
  reward_value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage loyalty_rewards" ON public.loyalty_rewards FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Add primary_color to shops for white-label
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS primary_color text;

-- Add refund support to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'payment';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_rules_shop ON public.automation_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_shop ON public.automation_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_shop ON public.api_keys(shop_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shop ON public.loyalty_rewards(shop_id);
