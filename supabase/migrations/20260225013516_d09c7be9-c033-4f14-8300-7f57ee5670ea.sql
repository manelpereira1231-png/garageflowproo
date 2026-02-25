
-- Update check constraint to include super_admin
ALTER TABLE public.shop_users DROP CONSTRAINT shop_users_role_check;
ALTER TABLE public.shop_users ADD CONSTRAINT shop_users_role_check
  CHECK (role = ANY (ARRAY['owner','manager','technician','super_admin']));

-- Create security definer function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Update all RLS policies with super_admin bypass

-- SHOPS
DROP POLICY IF EXISTS "Users manage own shop" ON public.shops;
CREATE POLICY "Users manage own shop" ON public.shops FOR ALL
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

-- CLIENTS
DROP POLICY IF EXISTS "Shop owners manage clients" ON public.clients;
CREATE POLICY "Shop owners manage clients" ON public.clients FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- VEHICLES
DROP POLICY IF EXISTS "Shop owners manage vehicles" ON public.vehicles;
CREATE POLICY "Shop owners manage vehicles" ON public.vehicles FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- QUOTES
DROP POLICY IF EXISTS "Shop owners manage quotes" ON public.quotes;
CREATE POLICY "Shop owners manage quotes" ON public.quotes FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- WORK_ORDERS
DROP POLICY IF EXISTS "Shop owners manage work_orders" ON public.work_orders;
CREATE POLICY "Shop owners manage work_orders" ON public.work_orders FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- ALERTS
DROP POLICY IF EXISTS "Shop owners manage alerts" ON public.alerts;
CREATE POLICY "Shop owners manage alerts" ON public.alerts FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Shop owners manage notifications" ON public.notifications;
CREATE POLICY "Shop owners manage notifications" ON public.notifications FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Shop owners manage subscriptions" ON public.subscriptions;
CREATE POLICY "Shop owners manage subscriptions" ON public.subscriptions FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- SHOP_USERS
DROP POLICY IF EXISTS "Shop owners manage shop_users" ON public.shop_users;
CREATE POLICY "Shop owners manage shop_users" ON public.shop_users FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));
