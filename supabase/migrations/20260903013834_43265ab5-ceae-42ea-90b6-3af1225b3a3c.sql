ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shops_demo_expiry
  ON public.shops (demo_expires_at)
  WHERE is_demo = true;

CREATE OR REPLACE FUNCTION public.is_demo_shop(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT s.is_demo
    FROM public.shops s
    WHERE s.id = _shop_id
  ), false)
$$;

REVOKE ALL ON FUNCTION public.is_demo_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_demo_shop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_shop(uuid) TO service_role;

COMMENT ON COLUMN public.shops.is_demo IS 'Identifica uma oficina temporária usada exclusivamente pela experiência Demo.';
COMMENT ON COLUMN public.shops.demo_expires_at IS 'Data após a qual a oficina Demo e os respetivos dados podem ser eliminados.';