-- Reorganize Enterprise plan: negotiated (contact sales), PT-only, no public price.
UPDATE public.plans
SET
  name = 'Enterprise',
  label = 'Contacte-nos',
  sort_order = 4,
  active = true,
  color = '#22c55e',
  icon = 'Rocket',
  description = 'Solução empresarial personalizada para redes de oficinas, grupos automóveis e empresas com operações de grande escala. Inclui implementação dedicada, configuração personalizada, suporte prioritário e condições comerciais ajustadas às necessidades do cliente.',
  cta_mode = 'demo',
  cta_label = 'Solicitar Demonstração',
  cta_url = NULL,
  badge_label = 'Contacte-nos',
  show_button = true,
  show_badge = true,
  show_price = false,
  show_trial = false,
  visible_on_landing = true,
  visible_on_billing = true,
  visible_on_checkout = false,
  visible_on_compare = true,
  trial_days = 0,
  supports_multi_shop = true,
  limits = jsonb_build_object(
    'max_shops', -1,
    'max_users', -1,
    'max_team_members', -1,
    'max_clients', -1,
    'max_vehicles', -1,
    'max_work_orders_month', -1,
    'max_quotes_per_month', -1,
    'max_services_catalog', -1,
    'max_products_stock', -1,
    'max_storage_mb', -1,
    'max_api_calls_per_day', -1,
    'max_ai_credits_month', -1,
    'max_sms_month', -1,
    'max_emails_month', -1,
    'max_whatsapp_month', -1,
    'max_campaigns', -1,
    'max_automations', -1,
    'marketplace_access', 1,
    'partner_commission_rate', COALESCE((limits->>'partner_commission_rate')::numeric, 0.2)
  ),
  updated_at = now()
WHERE slug = 'enterprise';

-- Enterprise is available only in Portugal.
-- Deactivate any non-PT price rows (keeps them for history, per spec).
UPDATE public.plan_country_prices
SET active = false, updated_at = now()
WHERE plan_slug = 'enterprise' AND country_code <> 'PT';

-- Ensure PT rows exist as internal reference only (not shown publicly).
UPDATE public.plan_country_prices
SET active = true, updated_at = now()
WHERE plan_slug = 'enterprise' AND country_code = 'PT';