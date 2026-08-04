ALTER TABLE public.manual_payouts
  ADD COLUMN IF NOT EXISTS extra_fee_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_fee_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.platform_commissions
  ADD COLUMN IF NOT EXISTS extra_fee_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_fee_amount numeric NOT NULL DEFAULT 0;

INSERT INTO public.platform_settings (key, value)
VALUES ('invoice_payments', jsonb_build_object(
  'platform_fee_percent', 3,
  'allow_without_connect', true,
  'no_connect_extra_percent', 0,
  'no_connect_fixed_fee', 0
))
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
  'platform_fee_percent', COALESCE((public.platform_settings.value ->> 'platform_fee_percent')::numeric, 3),
  'allow_without_connect', COALESCE((public.platform_settings.value ->> 'allow_without_connect')::boolean, true),
  'no_connect_extra_percent', COALESCE((public.platform_settings.value ->> 'no_connect_extra_percent')::numeric, 0),
  'no_connect_fixed_fee', COALESCE((public.platform_settings.value ->> 'no_connect_fixed_fee')::numeric, 0)
);