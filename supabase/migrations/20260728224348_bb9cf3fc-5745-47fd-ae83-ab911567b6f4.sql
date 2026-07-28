
DROP POLICY IF EXISTS "testimonials_public_read" ON public.testimonials;

REVOKE SELECT ON public.testimonials FROM anon;

CREATE OR REPLACE VIEW public.testimonials_public
WITH (security_invoker = true) AS
SELECT id, author_name, workshop_name, rating, content, created_at
FROM public.testimonials
WHERE status = 'approved' AND featured = true AND display_publicly = true;

GRANT SELECT ON public.testimonials_public TO anon, authenticated;
