
-- Make has_role() recognise the hardcoded super admin email so every existing
-- RLS policy written as has_role(auth.uid(),'super_admin') also grants access
-- to the platform super admin, without touching each policy individually.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    OR (
      _role = 'super_admin'::public.app_role
      AND EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = _user_id
          AND lower(email) = 'manelpereira11@gmail.com'
      )
    );
$$;

-- Backfill the super_admin role row for the hardcoded email (idempotent).
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'manelpereira11@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
