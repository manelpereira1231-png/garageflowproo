
-- Table to persist admin platform settings
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage platform_settings"
ON public.platform_settings
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Insert default settings
INSERT INTO public.platform_settings (key, value) VALUES
('plan_limits', '{"freePlanEnabled": true, "proPlanEnabled": true, "garagePlanEnabled": true, "freeQuoteLimit": 10, "freeUserLimit": 1, "proUserLimit": 5, "trialDays": 30}'::jsonb),
('notifications', '{"autoAlerts": true, "emailNotifications": true}'::jsonb),
('pdf', '{"watermarkOnFree": true}'::jsonb);

-- Function to get user emails for admin (avoids direct auth.users access)
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id as user_id, au.email::text as email
  FROM auth.users au
  WHERE public.is_super_admin(auth.uid())
$$;
