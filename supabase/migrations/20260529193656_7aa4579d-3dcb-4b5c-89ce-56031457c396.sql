DROP POLICY IF EXISTS "public reads published posts" ON public.seo_blog_posts;
DROP POLICY IF EXISTS "super admin reads all posts" ON public.seo_blog_posts;
DROP POLICY IF EXISTS "super admin inserts posts" ON public.seo_blog_posts;
DROP POLICY IF EXISTS "super admin updates posts" ON public.seo_blog_posts;
DROP POLICY IF EXISTS "super admin deletes posts" ON public.seo_blog_posts;

GRANT SELECT ON public.seo_blog_posts TO anon;
GRANT SELECT ON public.seo_blog_posts TO authenticated;
GRANT ALL ON public.seo_blog_posts TO service_role;

CREATE POLICY "public reads published posts"
  ON public.seo_blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "super admin reads all posts"
  ON public.seo_blog_posts
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin inserts posts"
  ON public.seo_blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin updates posts"
  ON public.seo_blog_posts
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin deletes posts"
  ON public.seo_blog_posts
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));