
-- Column-level GRANT so anon can only ever project safe columns from the base table.
GRANT SELECT (id, author_name, workshop_name, rating, content, created_at)
  ON public.testimonials TO anon;

-- Re-add the public read policy scoped to featured/approved rows only.
DROP POLICY IF EXISTS "testimonials_public_read" ON public.testimonials;
CREATE POLICY "testimonials_public_read"
ON public.testimonials
FOR SELECT
TO anon
USING (status = 'approved' AND featured = true AND display_publicly = true);

-- Recreate the public view as security_definer so it also works via PostgREST
-- (view queries the base table with the view owner's rights, which has full SELECT).
CREATE OR REPLACE VIEW public.testimonials_public
WITH (security_invoker = false) AS
SELECT id, author_name, workshop_name, rating, content, created_at
FROM public.testimonials
WHERE status = 'approved' AND featured = true AND display_publicly = true;

GRANT SELECT ON public.testimonials_public TO anon, authenticated;
