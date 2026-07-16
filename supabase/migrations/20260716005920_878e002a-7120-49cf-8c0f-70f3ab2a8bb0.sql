
-- 1. get_seller_emails: restrict to super admin
CREATE OR REPLACE FUNCTION public.get_seller_emails(seller_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT au.id AS user_id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(seller_ids)
    AND public.is_super_admin(auth.uid());
$function$;

REVOKE EXECUTE ON FUNCTION public.get_seller_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_emails(uuid[]) TO authenticated, service_role;

-- 2. audit_logs: only allow inserting rows attributed to self
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. platform_settings: restrict authenticated read to safe key list
DROP POLICY IF EXISTS "Authenticated read platform_settings" ON public.platform_settings;
CREATE POLICY "Authenticated read safe platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (key = ANY (ARRAY['landing','pricing','plan_limits','feature_gates','pdf','notifications']));
