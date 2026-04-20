
CREATE TABLE public.admin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  content_html text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  country_filter text,
  status text NOT NULL DEFAULT 'draft',
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage admin_campaigns"
ON public.admin_campaigns FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TABLE public.admin_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.admin_campaigns(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  segment text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_campaign_recipients_campaign ON public.admin_campaign_recipients(campaign_id);
CREATE INDEX idx_admin_campaign_recipients_status ON public.admin_campaign_recipients(status);

ALTER TABLE public.admin_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage admin_campaign_recipients"
ON public.admin_campaign_recipients FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_admin_campaigns_updated_at
BEFORE UPDATE ON public.admin_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
