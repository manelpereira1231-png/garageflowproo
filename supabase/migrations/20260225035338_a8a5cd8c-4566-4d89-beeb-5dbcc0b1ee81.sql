
-- Function to get all shop IDs a user has access to (owner OR team member)
CREATE OR REPLACE FUNCTION public.get_user_shop_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.shops WHERE user_id = _user_id
  UNION
  SELECT shop_id FROM public.shop_users WHERE user_id = _user_id
$$;

-- Update RLS policies for all tables to support team members via shop_users

-- CLIENTS
DROP POLICY IF EXISTS "Shop owners manage clients" ON public.clients;
CREATE POLICY "Shop members manage clients"
ON public.clients FOR ALL
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- VEHICLES
DROP POLICY IF EXISTS "Shop owners manage vehicles" ON public.vehicles;
CREATE POLICY "Shop members manage vehicles"
ON public.vehicles FOR ALL
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- QUOTES
DROP POLICY IF EXISTS "Shop owners manage quotes" ON public.quotes;
CREATE POLICY "Shop members manage quotes"
ON public.quotes FOR ALL
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- WORK_ORDERS
DROP POLICY IF EXISTS "Shop owners manage work_orders" ON public.work_orders;
CREATE POLICY "Shop members manage work_orders"
ON public.work_orders FOR ALL
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- ALERTS
DROP POLICY IF EXISTS "Shop owners manage alerts" ON public.alerts;
CREATE POLICY "Shop members manage alerts"
ON public.alerts FOR ALL
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Shop owners manage notifications" ON public.notifications;
CREATE POLICY "Shop members manage notifications"
ON public.notifications FOR ALL
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Shop owners manage subscriptions" ON public.subscriptions;
CREATE POLICY "Shop members view subscriptions"
ON public.subscriptions FOR SELECT
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Shop owners manage subscriptions"
ON public.subscriptions FOR ALL
USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- SHOP_USERS - owners can manage, members can view their own
DROP POLICY IF EXISTS "Shop owners manage shop_users" ON public.shop_users;
CREATE POLICY "Shop owners manage shop_users"
ON public.shop_users FOR ALL
USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Members can view shop_users in their shop"
ON public.shop_users FOR SELECT
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

-- SHOPS - allow team members to view their shops
DROP POLICY IF EXISTS "Users manage own shop" ON public.shops;
CREATE POLICY "Users manage own shop"
ON public.shops FOR ALL
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Team members can view their shops"
ON public.shops FOR SELECT
USING (id IN (SELECT shop_id FROM public.shop_users WHERE user_id = auth.uid()));
