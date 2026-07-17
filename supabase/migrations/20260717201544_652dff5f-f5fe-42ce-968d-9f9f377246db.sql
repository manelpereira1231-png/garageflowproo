DROP POLICY IF EXISTS "Group owner manages group shops" ON public.shops;

CREATE POLICY "Group owner can view group shops"
ON public.shops
FOR SELECT
TO authenticated
USING (
  group_owner_id = auth.uid()
  AND trim(coalesce(name, '')) <> ''
);

DROP POLICY IF EXISTS "Shop owners manage subscriptions" ON public.subscriptions;

CREATE POLICY "Shop owners manage subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR shop_id IN (
    SELECT sh.id
    FROM public.shops sh
    WHERE sh.user_id = auth.uid()
       OR (
         sh.group_owner_id = auth.uid()
         AND EXISTS (
           SELECT 1
           FROM public.shops root
           WHERE root.group_owner_id = auth.uid()
             AND root.user_id = auth.uid()
             AND trim(coalesce(root.name, '')) <> ''
         )
       )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR shop_id IN (
    SELECT sh.id
    FROM public.shops sh
    WHERE sh.user_id = auth.uid()
       OR (
         sh.group_owner_id = auth.uid()
         AND EXISTS (
           SELECT 1
           FROM public.shops root
           WHERE root.group_owner_id = auth.uid()
             AND root.user_id = auth.uid()
             AND trim(coalesce(root.name, '')) <> ''
         )
       )
  )
);