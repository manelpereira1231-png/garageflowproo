-- ============ 1. PLATFORM BILLING SETTINGS (singleton) ============
CREATE TABLE public.platform_billing_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true,
  legal_name text,
  tax_id text,
  address text,
  postal_code text,
  city text,
  country text NOT NULL DEFAULT 'PT',
  vat_regime text,
  vat_rate numeric NOT NULL DEFAULT 23,
  ix_account_name text,
  ix_api_key_encrypted text,
  ix_document_type text NOT NULL DEFAULT 'invoice_receipt',
  ix_sequence_id text,
  ix_connection_ok boolean NOT NULL DEFAULT false,
  ix_last_check_at timestamptz,
  ix_last_error text,
  paying_shops_target integer NOT NULL DEFAULT 20,
  fiscal_billing_active boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  activated_by uuid,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_billing_settings_singleton_uniq ON public.platform_billing_settings ((singleton));

GRANT SELECT, INSERT, UPDATE ON public.platform_billing_settings TO authenticated;
GRANT ALL ON public.platform_billing_settings TO service_role;
ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin manages platform billing settings"
  ON public.platform_billing_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.platform_billing_settings (singleton) VALUES (true);

-- ============ 2. PLATFORM INVOICES (GarageFlow -> oficina) ============
CREATE TABLE public.platform_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  subscription_id uuid,
  plan text,
  billing_cycle text,
  period_start timestamptz,
  period_end timestamptz,
  currency text NOT NULL DEFAULT 'EUR',
  amount_net numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  amount_total numeric NOT NULL DEFAULT 0,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_status text,
  stripe_hosted_url text,
  paid_at timestamptz,
  fiscal_status text NOT NULL DEFAULT 'pending_config'
    CHECK (fiscal_status IN ('pending_config','queued','issued','error','cancelled')),
  provider text,
  provider_invoice_id text,
  provider_number text,
  provider_pdf_url text,
  provider_series text,
  issued_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  email_status text NOT NULL DEFAULT 'not_sent'
    CHECK (email_status IN ('not_sent','sent','failed')),
  email_sent_at timestamptz,
  email_error text,
  billing_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_invoices_stripe_invoice_uniq
  ON public.platform_invoices (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX platform_invoices_shop_idx ON public.platform_invoices (shop_id, created_at DESC);
CREATE INDEX platform_invoices_status_idx ON public.platform_invoices (fiscal_status);

GRANT SELECT, INSERT, UPDATE ON public.platform_invoices TO authenticated;
GRANT ALL ON public.platform_invoices TO service_role;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages platform invoices"
  ON public.platform_invoices FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Shops read own platform invoices"
  ON public.platform_invoices FOR SELECT TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

-- ============ 3. AUDIT / EVENT LOG ============
CREATE TABLE public.platform_invoice_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_invoice_events_inv_idx ON public.platform_invoice_events (platform_invoice_id, created_at DESC);

GRANT SELECT ON public.platform_invoice_events TO authenticated;
GRANT ALL ON public.platform_invoice_events TO service_role;
ALTER TABLE public.platform_invoice_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads platform invoice events"
  ON public.platform_invoice_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============ 4. updated_at triggers ============
CREATE TRIGGER platform_billing_settings_touch
  BEFORE UPDATE ON public.platform_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_touch_updated_at();

CREATE TRIGGER platform_invoices_touch
  BEFORE UPDATE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_touch_updated_at();