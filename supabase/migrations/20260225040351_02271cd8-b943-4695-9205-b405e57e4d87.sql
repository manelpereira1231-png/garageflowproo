
-- Fix infinite recursion in RLS policies for shops and shop_users
-- The root cause: shop_users policies query shops, and shops policies query shop_users

-- Step 1: Drop all existing policies on shops and shop_users that cause recursion
DROP POLICY IF EXISTS "Users manage own shop" ON public.shops;
DROP POLICY IF EXISTS "Team members can view their shops" ON public.shops;
DROP POLICY IF EXISTS "Public shop access for quotes" ON public.shops;
DROP POLICY IF EXISTS "Shop owners manage shop_users" ON public.shop_users;
DROP POLICY IF EXISTS "Members can view shop_users in their shop" ON public.shop_users;

-- Step 2: Rewrite get_user_shop_ids to NOT touch shop_users via RLS (it's already SECURITY DEFINER, so it bypasses RLS - this is fine)
-- The function is already SECURITY DEFINER, so it bypasses RLS on both tables. The recursion happens because
-- the policies on shops reference shop_users (triggering shop_users policies) and shop_users policies reference shops (triggering shops policies).

-- Step 3: Create new non-recursive policies for shops
-- Owner access: simple direct check, no subquery to other tables
CREATE POLICY "Owner full access to shops"
  ON public.shops FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Super admin access
CREATE POLICY "Super admin access to shops"
  ON public.shops FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Team member read access: use SECURITY DEFINER function to avoid recursion
CREATE OR REPLACE FUNCTION public.user_is_shop_member(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE user_id = _user_id AND shop_id = _shop_id
  );
$$;

CREATE POLICY "Team members can view shops"
  ON public.shops FOR SELECT
  USING (public.user_is_shop_member(auth.uid(), id));

-- Public access for quote approval
CREATE POLICY "Public shop access for quotes"
  ON public.shops FOR SELECT
  USING (id IN (SELECT shop_id FROM public.quotes WHERE token IS NOT NULL));

-- Step 4: Create new non-recursive policies for shop_users
-- Owner manages their shop's users: use SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.user_owns_shop(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id AND user_id = _user_id
  );
$$;

CREATE POLICY "Shop owners manage shop_users"
  ON public.shop_users FOR ALL
  USING (public.user_owns_shop(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.user_owns_shop(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

-- Members can see other members in their shop
CREATE POLICY "Members view own shop_users"
  ON public.shop_users FOR SELECT
  USING (public.user_is_shop_member(auth.uid(), shop_id));

-- Step 5: Fix other tables that use get_user_shop_ids - these are fine because get_user_shop_ids is SECURITY DEFINER
-- and doesn't trigger RLS on shops/shop_users. No changes needed there.
