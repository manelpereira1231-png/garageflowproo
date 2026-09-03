CREATE TABLE public.shop_overrides (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_overrides TO authenticated;
GRANT ALL ON public.shop_overrides TO service_role;

ALTER TABLE public.shop_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_overrides_admin_all" ON public.shop_overrides
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'regional_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'regional_admin'::app_role)
);

CREATE POLICY "shop_overrides_members_read" ON public.shop_overrides
FOR SELECT TO authenticated
USING (public.user_has_shop_access(shop_id));

CREATE TRIGGER shop_overrides_set_updated_at
BEFORE UPDATE ON public.shop_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shop_overrides REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_overrides;