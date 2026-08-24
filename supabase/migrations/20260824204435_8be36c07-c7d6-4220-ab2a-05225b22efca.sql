CREATE POLICY "notifications_shop_access" ON public.notifications
AS PERMISSIVE FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR (user_id IS NULL AND public.has_capability(shop_id, 'dashboard.view'))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR (user_id IS NULL AND public.has_capability(shop_id, 'dashboard.view'))
);