-- 1) FEATURE FLAGS
CREATE TABLE IF NOT EXISTS public.system_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  rollout_percent integer NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.system_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read feature flags" ON public.system_feature_flags
  FOR SELECT USING (true);

CREATE POLICY "Super admin manage feature flags" ON public.system_feature_flags
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON public.system_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) SYSTEM BROADCASTS
CREATE TABLE IF NOT EXISTS public.system_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','success','error','promo')),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','erp','market','super_admin')),
  country_filter text,
  link_url text,
  link_label text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  views_count integer NOT NULL DEFAULT 0,
  dismissals_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.system_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active broadcasts" ON public.system_broadcasts
  FOR SELECT USING (
    active = true 
    AND starts_at <= now() 
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Super admin manage broadcasts" ON public.system_broadcasts
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_broadcasts_updated_at
  BEFORE UPDATE ON public.system_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_broadcasts_active ON public.system_broadcasts (active, starts_at, ends_at);

-- 3) BROADCAST DISMISSALS
CREATE TABLE IF NOT EXISTS public.system_broadcast_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.system_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, user_id)
);
ALTER TABLE public.system_broadcast_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissals" ON public.system_broadcast_dismissals
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- 4) ADMIN COUPONS
CREATE TABLE IF NOT EXISTS public.admin_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','amount','free_months','trial_extension')),
  discount_value numeric NOT NULL DEFAULT 0,
  applies_to_plan text NOT NULL DEFAULT 'any' CHECK (applies_to_plan IN ('any','pro','garage','free')),
  max_redemptions integer,
  redemptions_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.admin_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage coupons" ON public.admin_coupons
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated read active coupons by code"
  ON public.admin_coupons FOR SELECT TO authenticated
  USING (active = true);

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.admin_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) COUPON REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.admin_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.admin_coupons(id) ON DELETE CASCADE,
  shop_id uuid,
  user_id uuid,
  applied_at timestamptz NOT NULL DEFAULT now(),
  details jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.admin_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read redemptions" ON public.admin_coupon_redemptions
  FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated insert own redemption" ON public.admin_coupon_redemptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- 6) RPC: redeem coupon
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text, _shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM public.admin_coupons WHERE upper(code) = upper(_code) AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupão inválido');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupão expirado');
  END IF;
  IF c.max_redemptions IS NOT NULL AND c.redemptions_count >= c.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupão esgotado');
  END IF;

  -- Register redemption
  INSERT INTO public.admin_coupon_redemptions (coupon_id, shop_id, user_id)
  VALUES (c.id, _shop_id, auth.uid());

  UPDATE public.admin_coupons SET redemptions_count = redemptions_count + 1 WHERE id = c.id;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'applies_to_plan', c.applies_to_plan,
    'description', c.description
  );
END;
$$;

-- 7) Seed default feature flags
INSERT INTO public.system_feature_flags (key, label, description, enabled, category) VALUES
  ('market_enabled', 'GarageFlow Market', 'Marketplace público de veículos', true, 'product'),
  ('market_inspections', 'Inspeções Market', 'Sistema de inspeções pagas', true, 'product'),
  ('market_boosts', 'Boosts & Destaques', 'Promoção paga de anúncios', true, 'product'),
  ('ai_diagnosis', 'AI Service Advisor', 'Diagnóstico assistido por IA', true, 'ai'),
  ('public_signup_erp', 'Registo público ERP', 'Permite novos registos no ERP', true, 'auth'),
  ('public_signup_market', 'Registo público Market', 'Permite novos registos no Market', true, 'auth'),
  ('partner_program', 'Programa de Parceiros', 'Sistema de afiliados e parceiros', true, 'growth'),
  ('whatsapp_integration', 'WhatsApp', 'Envio de mensagens via WhatsApp', true, 'integrations')
ON CONFLICT (key) DO NOTHING;