CREATE TABLE IF NOT EXISTS public.platform_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE,
  shop_id uuid NOT NULL,
  invoice_number text,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_percent numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  stripe_session_id text,
  stripe_account_id text,
  source text NOT NULL DEFAULT 'stripe_connect',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_commissions TO authenticated;
GRANT ALL ON public.platform_commissions TO service_role;

ALTER TABLE public.platform_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read platform commissions" ON public.platform_commissions;
CREATE POLICY "Super admins read platform commissions"
  ON public.platform_commissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_platform_commissions_shop ON public.platform_commissions(shop_id);
CREATE INDEX IF NOT EXISTS idx_platform_commissions_created ON public.platform_commissions(created_at DESC);

INSERT INTO public.platform_settings (key, value)
VALUES ('invoice_payments', jsonb_build_object('platform_fee_percent', 3))
ON CONFLICT (key) DO NOTHING;