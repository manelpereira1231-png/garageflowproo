CREATE OR REPLACE FUNCTION public.get_public_platform_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'shops', (SELECT count(*) FROM public.shops),
    'work_orders', (SELECT count(*) FROM public.work_orders),
    'vehicles', (SELECT count(*) FROM public.vehicles),
    'reviews', (SELECT count(*) FROM public.testimonials WHERE status = 'approved' AND display_publicly IS TRUE),
    'avg_rating', (SELECT round(avg(rating)::numeric, 1) FROM public.testimonials WHERE status = 'approved' AND display_publicly IS TRUE)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_stats() TO anon, authenticated, service_role;