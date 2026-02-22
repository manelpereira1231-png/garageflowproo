
-- ============================================
-- GARAGEFLOW SaaS EXPANSION
-- Adds subscriptions, shop_users, notifications, alerts
-- WITHOUT altering existing tables
-- ============================================

-- 1. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'garage')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- 2. Shop users (multi-user per shop)
CREATE TABLE public.shop_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'technician' CHECK (role IN ('owner', 'manager', 'technician')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

ALTER TABLE public.shop_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage shop_users"
  ON public.shop_users FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- 3. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'alert', 'success')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage notifications"
  ON public.notifications FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- 4. Alerts (automated service reminders)
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('revision', 'oil_change', 'inspection', 'warranty', 'quote_expired', 'inactive_client', 'maintenance')),
  title text NOT NULL,
  message text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage alerts"
  ON public.alerts FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()));

-- 5. Auto-create FREE subscription when shop is created
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (shop_id, plan, status)
  VALUES (NEW.id, 'free', 'active');
  
  -- Also add owner to shop_users
  INSERT INTO public.shop_users (shop_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_shop_created
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_shop_subscription();
