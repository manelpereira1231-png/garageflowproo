CREATE TABLE public.pilot_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  city TEXT,
  team_size TEXT,
  current_tool TEXT,
  notes TEXT,
  source TEXT DEFAULT 'oficinas-piloto',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  user_agent TEXT,
  contacted_at TIMESTAMPTZ,
  demo_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  lost_reason TEXT,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.pilot_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_leads TO authenticated;
GRANT ALL ON public.pilot_leads TO service_role;

ALTER TABLE public.pilot_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a pilot lead"
ON public.pilot_leads FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view all pilot leads"
ON public.pilot_leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'regional_admin'::app_role));

CREATE POLICY "Admins can update pilot leads"
ON public.pilot_leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'regional_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'regional_admin'::app_role));

CREATE POLICY "Admins can delete pilot leads"
ON public.pilot_leads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pilot_leads_updated_at
BEFORE UPDATE ON public.pilot_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pilot_leads_status ON public.pilot_leads(status);
CREATE INDEX idx_pilot_leads_created_at ON public.pilot_leads(created_at DESC);