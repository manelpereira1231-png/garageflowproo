
-- =====================================================================
-- FEATURE FLAGS + PLAN MATRIX — single source of truth
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.features (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'core',
  is_core boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.features TO anon, authenticated;
GRANT ALL ON public.features TO service_role;

ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "features readable by all"
  ON public.features FOR SELECT
  USING (true);

CREATE POLICY "features writable by super admin"
  ON public.features FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- =====================================================================
CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_slug text NOT NULL CHECK (plan_slug IN ('free','pro','garage')),
  feature_slug text NOT NULL REFERENCES public.features(slug) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_slug, feature_slug)
);

GRANT SELECT ON public.plan_features TO anon, authenticated;
GRANT ALL ON public.plan_features TO service_role;

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features readable by all"
  ON public.plan_features FOR SELECT
  USING (true);

CREATE POLICY "plan_features writable by super admin"
  ON public.plan_features FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_features_touch
  BEFORE UPDATE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_plan_features_touch
  BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- SEED — catálogo de features
-- =====================================================================
INSERT INTO public.features (slug, name, description, category, is_core) VALUES
  ('dashboard','Dashboard','Visão geral da oficina','core',true),
  ('clients','Clientes','Gestão de clientes','core',true),
  ('vehicles','Veículos','Gestão de veículos','core',true),
  ('quotes','Orçamentos','Criar e gerir orçamentos','core',true),
  ('services','Serviços','Ordens de serviço','core',true),
  ('invoices','Faturação','Faturas e recibos','core',true),
  ('settings','Definições','Configurações da oficina','core',true),
  ('billing','Subscrição','Gestão de plano','core',true),
  ('workshop_mode','Modo Oficina','Vista mobile mecânico','ops',false),
  ('agenda','Agenda','Calendário de marcações','ops',false),
  ('inspections','Inspeções','Inspeções e checklists','ops',false),
  ('service_catalog','Catálogo de Serviços','Biblioteca de serviços','ops',false),
  ('stock','Inventário e Stock','Gestão de peças','ops',false),
  ('warranties','Garantias','Gestão de garantias','ops',false),
  ('financial_reports_basic','Relatórios Financeiros','Relatórios básicos','finance',false),
  ('financial_reports_advanced','Relatórios Avançados','Analytics avançados','finance',false),
  ('csv_export','Exportação CSV','Exportar dados','finance',false),
  ('alerts_basic','Alertas Básicos','Notificações simples','comms',false),
  ('alerts_advanced','Alertas Avançados','Regras complexas','comms',false),
  ('chat','Chat / Chatbot','Chat com clientes','comms',false),
  ('client_portal','Portal do Cliente','Acesso ao cliente','comms',false),
  ('quote_approval','Aprovação Online','Cliente aprova orçamento','comms',false),
  ('public_booking','Marcação Pública','Página /book/:slug','comms',false),
  ('marketing','Marketing','Campanhas','growth',false),
  ('automations','Automações','Fluxos automáticos','growth',false),
  ('loyalty','Fidelização','Programa de pontos','growth',false),
  ('referrals','Referências','Sistema de referências','growth',false),
  ('team_management','Equipa','Multi-utilizador','admin',false),
  ('multi_shop','Multi-Oficina','Várias oficinas','admin',false),
  ('api','API Pública','REST API v1','admin',false),
  ('support','Suporte','Tickets de suporte','core',true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_core = EXCLUDED.is_core;

-- =====================================================================
-- SEED — matriz plano × feature (sem grandfathering, conforme decisão)
-- =====================================================================
INSERT INTO public.plan_features (plan_slug, feature_slug, enabled, limits) VALUES
  -- FREE: apenas core + workshop + catálogo + quote_approval + referrals + support
  ('free','dashboard',true,'{}'),('free','clients',true,'{}'),('free','vehicles',true,'{}'),
  ('free','quotes',true,'{"monthly":10}'),('free','services',true,'{}'),
  ('free','invoices',true,'{}'),('free','settings',true,'{}'),('free','billing',true,'{}'),
  ('free','workshop_mode',true,'{}'),('free','service_catalog',true,'{}'),
  ('free','quote_approval',true,'{}'),('free','referrals',true,'{}'),('free','support',true,'{}'),
  ('free','agenda',false,'{}'),('free','inspections',false,'{}'),('free','stock',false,'{}'),
  ('free','warranties',false,'{}'),('free','financial_reports_basic',false,'{}'),
  ('free','financial_reports_advanced',false,'{}'),('free','csv_export',false,'{}'),
  ('free','alerts_basic',false,'{}'),('free','alerts_advanced',false,'{}'),
  ('free','chat',false,'{}'),('free','client_portal',false,'{}'),
  ('free','public_booking',false,'{}'),('free','marketing',false,'{}'),
  ('free','automations',false,'{}'),('free','loyalty',false,'{}'),
  ('free','team_management',false,'{"users":1}'),('free','multi_shop',false,'{"shops":1}'),
  ('free','api',false,'{}'),

  -- PRO
  ('pro','dashboard',true,'{}'),('pro','clients',true,'{}'),('pro','vehicles',true,'{}'),
  ('pro','quotes',true,'{}'),('pro','services',true,'{}'),('pro','invoices',true,'{}'),
  ('pro','settings',true,'{}'),('pro','billing',true,'{}'),('pro','workshop_mode',true,'{}'),
  ('pro','agenda',true,'{}'),('pro','inspections',true,'{}'),('pro','service_catalog',true,'{}'),
  ('pro','stock',true,'{}'),('pro','warranties',true,'{}'),
  ('pro','financial_reports_basic',true,'{}'),('pro','financial_reports_advanced',false,'{}'),
  ('pro','csv_export',true,'{}'),('pro','alerts_basic',true,'{}'),('pro','alerts_advanced',false,'{}'),
  ('pro','chat',false,'{}'),('pro','client_portal',true,'{}'),('pro','quote_approval',true,'{}'),
  ('pro','public_booking',true,'{}'),('pro','marketing',false,'{}'),('pro','automations',false,'{}'),
  ('pro','loyalty',false,'{}'),('pro','referrals',true,'{}'),
  ('pro','team_management',true,'{"users":5}'),('pro','multi_shop',false,'{"shops":1}'),
  ('pro','api',false,'{}'),('pro','support',true,'{}'),

  -- GARAGE: tudo
  ('garage','dashboard',true,'{}'),('garage','clients',true,'{}'),('garage','vehicles',true,'{}'),
  ('garage','quotes',true,'{}'),('garage','services',true,'{}'),('garage','invoices',true,'{}'),
  ('garage','settings',true,'{}'),('garage','billing',true,'{}'),('garage','workshop_mode',true,'{}'),
  ('garage','agenda',true,'{}'),('garage','inspections',true,'{}'),('garage','service_catalog',true,'{}'),
  ('garage','stock',true,'{}'),('garage','warranties',true,'{}'),
  ('garage','financial_reports_basic',true,'{}'),('garage','financial_reports_advanced',true,'{}'),
  ('garage','csv_export',true,'{}'),('garage','alerts_basic',true,'{}'),('garage','alerts_advanced',true,'{}'),
  ('garage','chat',true,'{}'),('garage','client_portal',true,'{}'),('garage','quote_approval',true,'{}'),
  ('garage','public_booking',true,'{}'),('garage','marketing',true,'{}'),('garage','automations',true,'{}'),
  ('garage','loyalty',true,'{}'),('garage','referrals',true,'{}'),
  ('garage','team_management',true,'{"users":999}'),('garage','multi_shop',true,'{"shops":5}'),
  ('garage','api',true,'{}'),('garage','support',true,'{}')
ON CONFLICT (plan_slug, feature_slug) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  limits = EXCLUDED.limits;

-- =====================================================================
-- RPC — verificação central
-- =====================================================================
CREATE OR REPLACE FUNCTION public.plan_has_feature(_plan text, _feature text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.plan_features
      WHERE plan_slug = lower(coalesce(_plan,'free'))
        AND feature_slug = _feature),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.plan_has_feature(text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_best_plan(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.plan FROM public.subscriptions s
      INNER JOIN public.shops sh ON sh.id = s.shop_id
      WHERE sh.user_id = _user_id AND s.status IN ('active','trialing')
      ORDER BY CASE s.plan WHEN 'garage' THEN 3 WHEN 'pro' THEN 2 ELSE 1 END DESC
      LIMIT 1),
    'free'
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_best_plan(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_can_use_feature(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Core features always allowed
    COALESCE((SELECT is_core FROM public.features WHERE slug = _feature), false)
    OR public.plan_has_feature(public.user_best_plan(_user_id), _feature)
    OR public.is_super_admin(_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.user_can_use_feature(uuid,text) TO authenticated, service_role;

-- =====================================================================
-- Realtime
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.features;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_features;
