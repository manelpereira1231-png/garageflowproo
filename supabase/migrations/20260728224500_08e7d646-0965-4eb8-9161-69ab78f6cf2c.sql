
CREATE OR REPLACE VIEW public.testimonials_public
WITH (security_invoker = true) AS
SELECT id, author_name, workshop_name, rating, content, created_at
FROM public.testimonials;

GRANT SELECT ON public.testimonials_public TO anon, authenticated;
