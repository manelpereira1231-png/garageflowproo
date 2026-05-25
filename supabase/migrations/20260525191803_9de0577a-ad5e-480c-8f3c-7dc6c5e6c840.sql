
CREATE TABLE IF NOT EXISTS public.seo_blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Gestão',
  keyword text DEFAULT '',
  meta_title text DEFAULT '',
  meta_description text DEFAULT '',
  og_image text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  views_count integer NOT NULL DEFAULT 0,
  reading_minutes integer NOT NULL DEFAULT 5,
  author text DEFAULT 'GarageFlow',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_blog_posts_status_idx ON public.seo_blog_posts(status);
CREATE INDEX IF NOT EXISTS seo_blog_posts_published_idx ON public.seo_blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS seo_blog_posts_scheduled_idx ON public.seo_blog_posts(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.seo_blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads published posts"
  ON public.seo_blog_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "super admin reads all posts"
  ON public.seo_blog_posts FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin inserts posts"
  ON public.seo_blog_posts FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin updates posts"
  ON public.seo_blog_posts FOR UPDATE
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin deletes posts"
  ON public.seo_blog_posts FOR DELETE
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER seo_blog_posts_updated_at
  BEFORE UPDATE ON public.seo_blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
