
CREATE TABLE public.marketing_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook','instagram','instagram_story','linkedin')),
  post_type TEXT NOT NULL DEFAULT 'feed' CHECK (post_type IN ('feed','story','reel','carousel')),
  title TEXT,
  body TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  cta TEXT,
  image_url TEXT,
  image_prompt TEXT,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','failed')),
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  external_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_posts TO authenticated;
GRANT ALL ON public.marketing_posts TO service_role;

ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_posts_super_admin_all"
ON public.marketing_posts FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_marketing_posts_updated
BEFORE UPDATE ON public.marketing_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.marketing_posts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('semi_auto','api')),
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  response JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.marketing_publish_log TO authenticated;
GRANT ALL ON public.marketing_publish_log TO service_role;

ALTER TABLE public.marketing_publish_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_publish_log_super_admin_read"
ON public.marketing_publish_log FOR SELECT
TO authenticated USING (is_super_admin(auth.uid()));

CREATE POLICY "marketing_publish_log_super_admin_insert"
ON public.marketing_publish_log FOR INSERT
TO authenticated WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX idx_marketing_posts_scheduled ON public.marketing_posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_marketing_posts_campaign ON public.marketing_posts(campaign_id);
CREATE INDEX idx_marketing_publish_log_campaign ON public.marketing_publish_log(campaign_id);
