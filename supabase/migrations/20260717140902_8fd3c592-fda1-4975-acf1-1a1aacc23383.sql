
ALTER TABLE public.plan_features DROP CONSTRAINT IF EXISTS plan_features_plan_slug_check;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trial_days integer,
  ADD COLUMN IF NOT EXISTS supports_multi_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS included_shops integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stripe_product_id text;

ALTER TABLE public.plan_country_prices
  ADD COLUMN IF NOT EXISTS stripe_coupon_id text,
  ADD COLUMN IF NOT EXISTS trial_days_override integer;

UPDATE public.plans SET limits = jsonb_build_object(
  'max_shops',1,'max_users',1,'max_vehicles',50,'max_clients',50,
  'max_quotes_per_month',20,'max_storage_mb',100,'max_api_calls_per_day',0,
  'partner_commission_rate',0.10
) WHERE slug='free' AND (limits IS NULL OR limits='{}'::jsonb);

UPDATE public.plans SET limits = jsonb_build_object(
  'max_shops',1,'max_users',5,'max_vehicles',5000,'max_clients',5000,
  'max_quotes_per_month',-1,'max_storage_mb',5000,'max_api_calls_per_day',1000,
  'partner_commission_rate',0.10
) WHERE slug='pro' AND (limits IS NULL OR limits='{}'::jsonb);

UPDATE public.plans SET limits = jsonb_build_object(
  'max_shops',5,'max_users',25,'max_vehicles',-1,'max_clients',-1,
  'max_quotes_per_month',-1,'max_storage_mb',50000,'max_api_calls_per_day',10000,
  'partner_commission_rate',0.20
), supports_multi_shop=true, included_shops=5
WHERE slug='garage' AND (limits IS NULL OR limits='{}'::jsonb);

UPDATE public.plans SET limits = jsonb_build_object(
  'max_shops',50,'max_users',-1,'max_vehicles',-1,'max_clients',-1,
  'max_quotes_per_month',-1,'max_storage_mb',-1,'max_api_calls_per_day',-1,
  'partner_commission_rate',0.20
), supports_multi_shop=true, included_shops=50
WHERE slug='enterprise' AND (limits IS NULL OR limits='{}'::jsonb);

-- Trigger dinâmico: herda plano do dono ordenando por sort_order desc
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_plan text; v_status text; v_customer text; v_sub text;
BEGIN
  SELECT s.plan, s.status, s.stripe_customer_id, s.stripe_subscription_id
    INTO v_plan, v_status, v_customer, v_sub
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  JOIN public.plans p ON p.slug = s.plan
  WHERE sh.owner_id = NEW.owner_id AND sh.id <> NEW.id AND p.active = true
  ORDER BY p.sort_order DESC, s.created_at DESC LIMIT 1;

  IF v_plan IS NULL THEN v_plan := 'free'; v_status := 'active'; END IF;

  INSERT INTO public.subscriptions (shop_id, plan, status, stripe_customer_id, stripe_subscription_id)
  VALUES (NEW.id, v_plan, COALESCE(v_status,'active'), v_customer, v_sub)
  ON CONFLICT (shop_id) DO NOTHING;
  RETURN NEW;
END $$;

-- Função dinâmica de limite de oficinas (mantém retorno boolean para não quebrar callers)
CREATE OR REPLACE FUNCTION public.check_shop_creation_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public AS $$
DECLARE
  v_current int; v_plan text; v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM public.shops WHERE owner_id = _user_id;
  SELECT s.plan INTO v_plan
    FROM public.subscriptions s
    JOIN public.shops sh ON sh.id = s.shop_id
    JOIN public.plans p ON p.slug = s.plan
    WHERE sh.owner_id = _user_id
    ORDER BY p.sort_order DESC LIMIT 1;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  SELECT COALESCE((limits->>'max_shops')::int, 1) INTO v_max FROM public.plans WHERE slug = v_plan;
  RETURN (v_max < 0) OR (v_current < v_max);
END $$;

-- Função auxiliar para leitura completa de estado (para UI)
CREATE OR REPLACE FUNCTION public.get_shop_creation_status(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public AS $$
DECLARE
  v_current int; v_plan text; v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM public.shops WHERE owner_id = _user_id;
  SELECT s.plan INTO v_plan
    FROM public.subscriptions s
    JOIN public.shops sh ON sh.id = s.shop_id
    JOIN public.plans p ON p.slug = s.plan
    WHERE sh.owner_id = _user_id
    ORDER BY p.sort_order DESC LIMIT 1;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  SELECT COALESCE((limits->>'max_shops')::int, 1) INTO v_max FROM public.plans WHERE slug = v_plan;
  RETURN jsonb_build_object(
    'allowed', (v_max < 0) OR (v_current < v_max),
    'current', v_current, 'max', v_max, 'plan', v_plan
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_shop_creation_status(uuid) TO authenticated, service_role;
