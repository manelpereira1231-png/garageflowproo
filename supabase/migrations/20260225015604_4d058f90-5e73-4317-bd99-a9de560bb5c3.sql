
-- Create audit_logs table for tracking admin actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read audit logs
CREATE POLICY "Super admin can read audit logs"
ON public.audit_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Allow insert from authenticated users (for logging actions)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs (entity_type);
