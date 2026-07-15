-- Cleanup ghost shops created for invited team members.
--
-- Root cause: handle_new_user trigger created a shop for every new auth user
-- unless raw_user_meta_data.skip_shop_creation='true'. Invites did not pass
-- this flag, so an invited technician/reception became "owner" of an empty
-- phantom shop. On login useShopContext defaulted to that shop and RBAC
-- granted full access. Fix: delete empty owned shops for users who are
-- already members of at least one real (named) shop.

WITH candidates AS (
  SELECT s.id
  FROM public.shops s
  WHERE COALESCE(NULLIF(trim(s.name), ''), '') = ''
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.shop_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.shop_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.work_orders w WHERE w.shop_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.shop_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.shop_id = s.id)
    AND EXISTS (
      SELECT 1 FROM public.shop_users su
      JOIN public.shops s2 ON s2.id = su.shop_id
      WHERE su.user_id = s.user_id
        AND su.shop_id <> s.id
        AND COALESCE(NULLIF(trim(s2.name), ''), '') <> ''
    )
)
DELETE FROM public.shops WHERE id IN (SELECT id FROM candidates);

-- Also remove owner rows in shop_users that pointed at those ghosts
-- (in case any orphan remained after FK cascade).
DELETE FROM public.shop_users su
WHERE su.role = 'owner'
  AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = su.shop_id);
