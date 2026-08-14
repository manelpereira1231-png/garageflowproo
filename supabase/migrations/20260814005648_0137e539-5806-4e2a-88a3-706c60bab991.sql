CREATE OR REPLACE FUNCTION public.user_has_shop_access(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _shop_id IS NOT NULL AND auth.uid() IS NOT NULL AND (
    -- group owner of a valid group
    EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.id = _shop_id
        AND sh.group_owner_id = auth.uid()
        AND trim(coalesce(sh.name, '')) <> ''
        AND EXISTS (
          SELECT 1 FROM public.shops root
          WHERE root.group_owner_id = auth.uid()
            AND root.user_id = auth.uid()
            AND trim(coalesce(root.name, '')) <> ''
        )
    )
    -- direct owner (allowing the initial unnamed shop during onboarding)
    OR EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.id = _shop_id
        AND sh.user_id = auth.uid()
        AND (
          trim(coalesce(sh.name, '')) <> ''
          OR (
            NOT EXISTS (
              SELECT 1 FROM public.shops s2
              WHERE s2.user_id = auth.uid() AND trim(coalesce(s2.name, '')) <> ''
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.shop_users su
              JOIN public.shops s3 ON s3.id = su.shop_id
              WHERE su.user_id = auth.uid() AND trim(coalesce(s3.name, '')) <> ''
            )
          )
        )
    )
    -- team member
    OR EXISTS (
      SELECT 1 FROM public.shop_users su
      JOIN public.shops sh ON sh.id = su.shop_id
      WHERE su.shop_id = _shop_id
        AND su.user_id = auth.uid()
        AND trim(coalesce(sh.name, '')) <> ''
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_shop_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_shop_access(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Shop members view subscriptions" ON public.subscriptions;
CREATE POLICY "Shop members view subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (public.user_has_shop_access(shop_id) OR public.is_super_admin(auth.uid()));