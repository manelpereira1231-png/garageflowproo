CREATE TABLE public.part_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  make text, model text, engine text, version text,
  year_from int, year_to int,
  oem_reference text, part_brand text, engine_code text, vin text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_applications TO authenticated;
GRANT ALL ON public.part_applications TO service_role;
ALTER TABLE public.part_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage part applications" ON public.part_applications FOR ALL TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
    AND EXISTS (SELECT 1 FROM public.parts p WHERE p.id = part_id AND p.shop_id = part_applications.shop_id));
CREATE INDEX part_applications_part_idx ON public.part_applications(part_id);
CREATE INDEX part_applications_shop_make_idx ON public.part_applications(shop_id, lower(make), lower(model));