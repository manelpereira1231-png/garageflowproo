
-- Catálogo de tipos de limites disponíveis (fonte para o editor dinâmico de limites no Admin)
CREATE TABLE IF NOT EXISTS public.plan_limits_catalog (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'count', -- count | gb | per_month | boolean | percent
  category text NOT NULL DEFAULT 'limits', -- limits | channels | ai | access | commerce
  sort_order int NOT NULL DEFAULT 100,
  allow_unlimited boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_limits_catalog TO anon, authenticated;
GRANT ALL ON public.plan_limits_catalog TO service_role;

ALTER TABLE public.plan_limits_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits_catalog readable by all"
  ON public.plan_limits_catalog FOR SELECT
  USING (true);

CREATE POLICY "plan_limits_catalog managed by super admin"
  ON public.plan_limits_catalog FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.set_plan_limits_catalog_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS plan_limits_catalog_updated_at ON public.plan_limits_catalog;
CREATE TRIGGER plan_limits_catalog_updated_at
  BEFORE UPDATE ON public.plan_limits_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_limits_catalog_updated_at();

-- Seed de limites (idempotente)
INSERT INTO public.plan_limits_catalog (key, label, description, unit, category, sort_order, allow_unlimited) VALUES
  ('max_shops', 'Oficinas máximas', 'Número máximo de oficinas (multi-oficina).', 'count', 'limits', 10, true),
  ('max_users', 'Utilizadores máximos', 'Colaboradores permitidos por oficina.', 'count', 'limits', 20, true),
  ('max_team_members', 'Membros de equipa', 'Equipa técnica (mecânicos/recepção).', 'count', 'limits', 25, true),
  ('max_clients', 'Clientes', 'Total de clientes registados.', 'count', 'limits', 30, true),
  ('max_vehicles', 'Veículos', 'Total de veículos registados.', 'count', 'limits', 40, true),
  ('max_work_orders_month', 'Ordens de serviço / mês', 'Ordens de serviço criadas por mês.', 'per_month', 'limits', 50, true),
  ('max_quotes_per_month', 'Orçamentos / mês', 'Orçamentos gerados por mês.', 'per_month', 'limits', 60, true),
  ('max_services_catalog', 'Serviços no catálogo', 'Tamanho do catálogo de serviços.', 'count', 'limits', 70, true),
  ('max_products_stock', 'Produtos em stock', 'Tamanho do inventário.', 'count', 'limits', 80, true),
  ('max_storage_mb', 'Armazenamento (MB)', 'Fotos, PDFs e anexos.', 'count', 'limits', 90, true),
  ('max_api_calls_per_day', 'API — chamadas / dia', 'Chamadas à API pública por dia.', 'per_month', 'limits', 100, true),
  ('max_ai_credits_month', 'Créditos IA / mês', 'Consultas ao assistente IA.', 'per_month', 'ai', 110, true),
  ('max_sms_month', 'SMS / mês', 'Mensagens SMS enviadas.', 'per_month', 'channels', 120, true),
  ('max_emails_month', 'Emails / mês', 'Emails transacionais/marketing.', 'per_month', 'channels', 130, true),
  ('max_whatsapp_month', 'WhatsApp / mês', 'Mensagens WhatsApp.', 'per_month', 'channels', 140, true),
  ('max_campaigns', 'Campanhas de marketing', 'Campanhas ativas em simultâneo.', 'count', 'channels', 150, true),
  ('max_automations', 'Automações', 'Fluxos de automação ativos.', 'count', 'channels', 160, true),
  ('marketplace_access', 'Acesso ao Marketplace', 'Permite vender/comprar no GarageFlow Market.', 'boolean', 'access', 200, false),
  ('partner_commission_rate', 'Comissão de parceiros', 'Percentagem paga a parceiros/afiliados.', 'percent', 'commerce', 210, false)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  allow_unlimited = EXCLUDED.allow_unlimited;

-- Garante limits jsonb não-nulo em todos os planos
UPDATE public.plans SET limits = COALESCE(limits, '{}'::jsonb) WHERE limits IS NULL;
