-- ============================================================
-- 1. COUNTRY SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.country_settings (
  code text PRIMARY KEY,
  name text NOT NULL,
  flag_emoji text NOT NULL DEFAULT '🌍',
  currency text NOT NULL,
  currency_symbol text NOT NULL,
  locale text NOT NULL,
  supported_languages text[] NOT NULL DEFAULT ARRAY['en'],
  default_language text NOT NULL DEFAULT 'en',
  timezones text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- SaaS pricing
  saas_pro_monthly numeric NOT NULL DEFAULT 0,
  saas_pro_yearly numeric NOT NULL DEFAULT 0,
  saas_garage_monthly numeric NOT NULL DEFAULT 0,
  saas_garage_yearly numeric NOT NULL DEFAULT 0,
  saas_trial_days int NOT NULL DEFAULT 30,
  -- Market inspection pricing
  inspection_price numeric NOT NULL DEFAULT 0,
  inspection_shop_share numeric NOT NULL DEFAULT 0,
  inspection_platform_share numeric NOT NULL DEFAULT 0,
  -- Market commission
  market_commission_rate numeric NOT NULL DEFAULT 0.02,
  -- Stripe price IDs (per country)
  stripe_pro_monthly text,
  stripe_pro_yearly text,
  stripe_garage_monthly text,
  stripe_garage_yearly text,
  -- Tax label (IVA, GST, VAT, Impostos, Sales Tax...)
  tax_label text NOT NULL DEFAULT 'Tax',
  -- Status
  active boolean NOT NULL DEFAULT false,
  launch_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER country_settings_updated_at
BEFORE UPDATE ON public.country_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.country_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read active countries (needed for signup, landing, pricing display)
CREATE POLICY "Active countries are publicly readable"
ON public.country_settings FOR SELECT
USING (active = true OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages countries (insert)"
ON public.country_settings FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages countries (update)"
ON public.country_settings FOR UPDATE
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages countries (delete)"
ON public.country_settings FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 2. SEED INITIAL COUNTRIES
-- ============================================================
INSERT INTO public.country_settings (
  code, name, flag_emoji, currency, currency_symbol, locale,
  supported_languages, default_language, timezones,
  saas_pro_monthly, saas_pro_yearly, saas_garage_monthly, saas_garage_yearly, saas_trial_days,
  inspection_price, inspection_shop_share, inspection_platform_share,
  market_commission_rate, tax_label, active,
  stripe_pro_monthly, stripe_pro_yearly, stripe_garage_monthly, stripe_garage_yearly
) VALUES
  -- 🇵🇹 PORTUGAL (active, updated to 29.90€/17€)
  ('PT', 'Portugal', '🇵🇹', 'EUR', '€', 'pt-PT',
   ARRAY['pt','en','es'], 'pt', ARRAY['Europe/Lisbon','Atlantic/Madeira','Atlantic/Azores'],
   49, 490, 99, 990, 30,
   29.90, 17.00, 12.90,
   0.02, 'IVA', true,
   'price_1T4YARE1zL2Sl1ZT0iAS9Cmk','price_1T49EZE1zL2Sl1ZTHGB40FiB',
   'price_1T4YAeE1zL2Sl1ZTrqc35wZy','price_1T49EnE1zL2Sl1ZTs0crtbLM'),
  -- 🇧🇷 BRASIL (active)
  ('BR', 'Brasil', '🇧🇷', 'BRL', 'R$', 'pt-BR',
   ARRAY['pt-BR','en'], 'pt-BR',
   ARRAY['America/Sao_Paulo','America/Fortaleza','America/Recife','America/Bahia','America/Belem','America/Manaus','America/Cuiaba','America/Porto_Velho','America/Boa_Vista','America/Campo_Grande','America/Rio_Branco','America/Maceio','America/Araguaina','America/Noronha','America/Santarem','America/Eirunepe'],
   97, 970, 197, 1970, 30,
   89.90, 50.00, 39.90,
   0.02, 'Impostos', true,
   'price_1TFP7uE1zL2Sl1ZTQxdzHWRv','price_1TFP8EE1zL2Sl1ZTorzoNWLQ',
   'price_1TFP8dE1zL2Sl1ZT7N3wnDIY','price_1TFP8wE1zL2Sl1ZTuTK1wiqu'),
  -- 🇮🇳 ÍNDIA (active — new market!)
  ('IN', 'India', '🇮🇳', 'INR', '₹', 'en-IN',
   ARRAY['en','hi'], 'en', ARRAY['Asia/Kolkata'],
   999, 9990, 1999, 19990, 30,
   499.00, 300.00, 199.00,
   0.02, 'GST', true,
   NULL, NULL, NULL, NULL),
  -- 🇪🇸 ESPANHA
  ('ES', 'España', '🇪🇸', 'EUR', '€', 'es-ES',
   ARRAY['es','en'], 'es', ARRAY['Europe/Madrid','Atlantic/Canary'],
   49, 490, 99, 990, 30,
   29.90, 17.00, 12.90,
   0.02, 'IVA', false, NULL, NULL, NULL, NULL),
  -- 🇫🇷 FRANÇA
  ('FR', 'France', '🇫🇷', 'EUR', '€', 'fr-FR',
   ARRAY['fr','en'], 'fr', ARRAY['Europe/Paris'],
   49, 490, 99, 990, 30,
   29.90, 17.00, 12.90,
   0.02, 'TVA', false, NULL, NULL, NULL, NULL),
  -- 🇩🇪 ALEMANHA
  ('DE', 'Deutschland', '🇩🇪', 'EUR', '€', 'de-DE',
   ARRAY['de','en'], 'de', ARRAY['Europe/Berlin'],
   49, 490, 99, 990, 30,
   29.90, 17.00, 12.90,
   0.02, 'MwSt', false, NULL, NULL, NULL, NULL),
  -- 🇬🇧 REINO UNIDO
  ('UK', 'United Kingdom', '🇬🇧', 'GBP', '£', 'en-GB',
   ARRAY['en'], 'en', ARRAY['Europe/London'],
   45, 450, 89, 890, 30,
   29.00, 17.00, 12.00,
   0.02, 'VAT', false, NULL, NULL, NULL, NULL),
  -- 🇺🇸 ESTADOS UNIDOS
  ('US', 'United States', '🇺🇸', 'USD', '$', 'en-US',
   ARRAY['en','es'], 'en',
   ARRAY['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Phoenix'],
   49, 490, 99, 990, 30,
   34.90, 20.00, 14.90,
   0.02, 'Sales Tax', false, NULL, NULL, NULL, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. ADD COUNTRY TO SHOPS & SELLERS
-- ============================================================
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'PT' REFERENCES public.country_settings(code);
ALTER TABLE public.carity_seller_profiles ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'PT' REFERENCES public.country_settings(code);

CREATE INDEX IF NOT EXISTS idx_shops_country ON public.shops(country_code);
CREATE INDEX IF NOT EXISTS idx_carity_sellers_country ON public.carity_seller_profiles(country_code);

-- ============================================================
-- 4. REGIONAL ADMIN ROLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'regional_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'regional_admin';
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- app_role enum doesn't exist, create it
  CREATE TYPE public.app_role AS ENUM ('super_admin','regional_admin','admin','user');
END$$;

CREATE TABLE IF NOT EXISTS public.regional_admin_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.country_settings(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_regional_admin_user ON public.regional_admin_countries(user_id);
CREATE INDEX IF NOT EXISTS idx_regional_admin_country ON public.regional_admin_countries(country_code);

ALTER TABLE public.regional_admin_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages regional admins (select)"
ON public.regional_admin_countries FOR SELECT
USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super admin manages regional admins (insert)"
ON public.regional_admin_countries FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages regional admins (delete)"
ON public.regional_admin_countries FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_regional_admin_for(_user_id uuid, _country_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.regional_admin_countries
    WHERE user_id = _user_id AND country_code = _country_code
  ) OR public.is_super_admin(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_admin_countries(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code FROM public.country_settings WHERE public.is_super_admin(_user_id)
  UNION
  SELECT country_code FROM public.regional_admin_countries WHERE user_id = _user_id;
$$;

-- ============================================================
-- 6. GET COUNTRY CONFIG (used by edge functions / frontend)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_country_config(_code text)
RETURNS public.country_settings
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.country_settings WHERE code = upper(_code) AND active = true LIMIT 1;
$$;